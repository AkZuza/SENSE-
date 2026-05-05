import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from scipy.signal import butter, filtfilt
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import mne
import warnings
import json

warnings.filterwarnings("ignore")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ============================================================
# EEGNet definition (must match training)
# ============================================================
class EEGNet(nn.Module):
    def __init__(self, C=23, T=512, F1=8, D=2,
                 dropout=0.5, num_classes=3):
        super().__init__()
        F2 = F1 * D
        kern1 = T // 4
        self.conv1 = nn.Conv2d(1, F1, (1, kern1),
                               padding=(0, kern1//2), bias=False)
        self.bn1   = nn.BatchNorm2d(F1)
        self.conv2 = nn.Conv2d(F1, F1*D, (C, 1),
                               groups=F1, bias=False)
        self.bn2   = nn.BatchNorm2d(F1*D)
        self.pool1 = nn.AvgPool2d((1, 4))
        self.drop1 = nn.Dropout(dropout)
        kern2 = T // 16
        self.conv3 = nn.Conv2d(F2, F2, (1, kern2),
                               padding=(0, kern2//2),
                               groups=F2, bias=False)
        self.conv4 = nn.Conv2d(F2, F2, (1, 1), bias=False)
        self.bn3   = nn.BatchNorm2d(F2)
        self.pool2 = nn.AvgPool2d((1, 8))
        self.drop2 = nn.Dropout(dropout)
        self._flat = self._get_flat(C, T)
        self.fc    = nn.Linear(self._flat, num_classes)

    def _get_flat(self, C, T):
        with torch.no_grad():
            x = torch.zeros(1, 1, C, T)
            x = self.pool1(self.bn2(self.conv2(self.bn1(self.conv1(x)))))
            x = self.pool2(self.bn3(self.conv4(self.conv3(x))))
            return x.numel()

    def forward(self, x):
        x = F.elu(self.bn1(self.conv1(x)))
        x = F.elu(self.bn2(self.conv2(x)))
        x = self.drop1(self.pool1(x))
        x = F.elu(self.bn3(self.conv4(self.conv3(x))))
        x = self.drop2(self.pool2(x))
        return self.fc(x.reshape(x.size(0), -1))

# Constants
CHECKPOINT  = "eegnet_3class_chb01.pt"
C_MODEL     = 23       # channels model was trained on
T_MODEL     = 512      # time samples model was trained on (2s @ 256Hz)
SFREQ       = 256.0
WINDOW_SEC  = 2
STEP_SEC    = 1
CLASS_NAMES  = ["Interictal", "Pre-ictal", "Ictal"]
CLASS_COLORS = ["#3498db", "#f39c12", "#e74c3c"]

BANDS = {
    "delta": (1,  4),
    "theta": (4,  8),
    "alpha": (8,  13),
    "beta":  (13, 30),
    "gamma": (30, 80),
}

# Try to load model globally if it exists
model = None
if os.path.exists(CHECKPOINT):
    try:
        model = EEGNet(C=C_MODEL, T=T_MODEL, num_classes=3).to(device)
        model.load_state_dict(torch.load(CHECKPOINT, map_location=device))
        model.eval()
        print("EEGNet model loaded.")
    except Exception as e:
        print(f"Failed to load EEGNet model: {e}")
else:
    print(f"Warning: {CHECKPOINT} not found. Running with mock inference if EDF uploaded.")


def bandpass(data, lo, hi, fs):
    b, a = butter(4, [lo/(fs/2), hi/(fs/2)], btype='band')
    return filtfilt(b, a, data, axis=-1)

def band_power(seg, sfreq):
    powers = {}
    for bname, (lo, hi) in BANDS.items():
        filtered = bandpass(seg, lo, hi, sfreq)
        powers[bname] = float(np.mean(filtered**2))
    return powers

def get_mock_predictions(num_windows):
    """Fallback if model isn't available."""
    # mostly interictal (0), some pre-ictal (1), rare ictal (2)
    probs = np.random.dirichlet((5, 1, 0.2), num_windows)
    preds = np.argmax(probs, axis=1)
    return preds, probs

def run_inference(edf_path, batch_size=64):
    print(f"Loading {os.path.basename(edf_path)} ...")
    raw  = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)
    raw.pick("eeg")
    data  = raw.get_data().astype(np.float32)   # (C, T)
    sfreq = raw.info['sfreq']
    C, total_T = data.shape
    duration_s = total_T / sfreq

    # resample if needed
    if sfreq != SFREQ:
        raw.resample(SFREQ)
        data  = raw.get_data().astype(np.float32)
        sfreq = SFREQ

    # trim / pad channels to match model
    if C > C_MODEL:
        data = data[:C_MODEL, :]
        C    = C_MODEL
    elif C < C_MODEL:
        pad  = np.zeros((C_MODEL - C, data.shape[1]), dtype=np.float32)
        data = np.concatenate([data, pad], axis=0)
        C    = C_MODEL

    win  = int(WINDOW_SEC * sfreq)
    step = int(STEP_SEC   * sfreq)

    # build windows
    segs, t_starts = [], []
    for s in range(0, data.shape[1] - win, step):
        seg = data[:, s:s+win]
        seg = (seg - seg.mean(axis=1, keepdims=True)) \
            / (seg.std(axis=1,  keepdims=True) + 1e-6)
        segs.append(seg)
        t_starts.append(s / sfreq)

    segs     = np.array(segs, dtype=np.float32)   # (N, C, T)
    t_starts = np.array(t_starts)

    if model is not None:
        segs_in  = segs[:, np.newaxis, :, :]           # (N, 1, C, T)
        all_logits = []
        with torch.no_grad():
            for i in range(0, len(segs_in), batch_size):
                xb = torch.tensor(segs_in[i:i+batch_size]).to(device)
                all_logits.append(model(xb).cpu().numpy())
        logits = np.vstack(all_logits)
        probs  = np.exp(logits) / np.exp(logits).sum(axis=1, keepdims=True)
        preds  = np.argmax(probs, axis=1)
    else:
        # Mock inference
        preds, probs = get_mock_predictions(len(segs))

    # band powers + channel activation per window
    rows = []
    for i, (seg, t0, pred, prob) in enumerate(zip(segs, t_starts, preds, probs)):
        bp = band_power(seg, sfreq)
        rows.append({
            "t_start":        float(t0),
            "t_end":          float(t0 + WINDOW_SEC),
            "pred_class":     int(pred),
            "pred_label":     CLASS_NAMES[pred],
            "prob_interictal": float(prob[0]),
            "prob_preictal":   float(prob[1]),
            "prob_ictal":      float(prob[2]),
            "confidence":      float(prob[pred]),
            **bp,
            "channel_rms":    float(np.sqrt(np.mean(seg**2))),
        })

    df = pd.DataFrame(rows)

    # contiguous segment detection
    segments = []
    if len(df):
        cur_label = df.iloc[0]['pred_label']
        cur_start = df.iloc[0]['t_start']
        cur_probs = [df.iloc[0][['prob_interictal','prob_preictal','prob_ictal']].values]
        for _, row in df.iloc[1:].iterrows():
            if row['pred_label'] == cur_label:
                cur_probs.append(row[['prob_interictal','prob_preictal','prob_ictal']].values)
            else:
                mean_p = np.mean(cur_probs, axis=0)
                segments.append({
                    "label":      cur_label,
                    "class":      CLASS_NAMES.index(cur_label),
                    "t_start":    cur_start,
                    "t_end":      row['t_start'],
                    "duration_s": row['t_start'] - cur_start,
                    "mean_prob":  float(mean_p[CLASS_NAMES.index(cur_label)]),
                })
                cur_label = row['pred_label']
                cur_start = row['t_start']
                cur_probs = [row[['prob_interictal','prob_preictal','prob_ictal']].values]
        mean_p = np.mean(cur_probs, axis=0)
        segments.append({
            "label":      cur_label,
            "class":      CLASS_NAMES.index(cur_label),
            "t_start":    cur_start,
            "t_end":      df.iloc[-1]['t_end'],
            "duration_s": df.iloc[-1]['t_end'] - cur_start,
            "mean_prob":  float(mean_p[CLASS_NAMES.index(cur_label)]),
        })

    # raw EEG for plotting (first 4 channels, decimated)
    decimate = max(1, int(sfreq // 64))
    raw_eeg  = {i: data[i, ::decimate].tolist() for i in range(min(4, C_MODEL))}
    raw_t    = (np.arange(data.shape[1])[::decimate] / sfreq).tolist()

    meta = {
        "filename":   os.path.basename(edf_path),
        "sfreq":      sfreq,
        "n_channels": C,
        "duration_s": duration_s,
        "n_windows":  len(df),
        "n_segments": len(segments),
        "ictal_windows":    int((preds == 2).sum()),
        "preictal_windows": int((preds == 1).sum()),
        "interictal_windows": int((preds == 0).sum()),
    }

    return df, segments, raw_eeg, raw_t, meta

def build_figures(df, segments, raw_eeg, raw_t, meta):
    COLOR_MAP = {
        "Interictal": "#3498db",
        "Pre-ictal":  "#f39c12",
        "Ictal":      "#e74c3c",
    }

    # Fig 1: Timeline
    fig_timeline = go.Figure()
    for seg in segments:
        fig_timeline.add_vrect(
            x0=seg['t_start'], x1=seg['t_end'],
            fillcolor=COLOR_MAP[seg['label']],
            opacity=0.25, line_width=0,
            annotation_text=seg['label'] if seg['duration_s'] > 10 else "",
            annotation_position="top left",
            annotation_font_size=9,
        )
    for cls, col in zip(CLASS_NAMES, CLASS_COLORS):
        col_name = f"prob_{cls.lower().replace('-','')}"
        fig_timeline.add_trace(go.Scatter(
            x=df['t_start'], y=df[col_name],
            mode='lines', name=f"P({cls})",
            line=dict(color=col, width=1.2),
        ))
    fig_timeline.update_layout(
        title="Segment timeline — predicted class probabilities",
        xaxis_title="Time (s)", yaxis_title="Probability",
        yaxis=dict(range=[0, 1]),
        legend=dict(orientation='h', y=-0.2),
        height=350, margin=dict(l=50, r=20, t=50, b=60),
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#e2e8f0'
    )

    # Fig 2: Raw EEG
    fig_eeg = make_subplots(
        rows=len(raw_eeg), cols=1, shared_xaxes=True,
        subplot_titles=[f"Ch {i}" for i in raw_eeg],
        vertical_spacing=0.04,
    )
    for i, (ch_idx, trace) in enumerate(raw_eeg.items()):
        fig_eeg.add_trace(
            go.Scatter(x=raw_t, y=trace, mode='lines',
                       line=dict(width=0.6, color='#94a3b8'),
                       name=f"Ch {ch_idx}", showlegend=False),
            row=i+1, col=1
        )
        for seg in segments:
            fig_eeg.add_vrect(
                x0=seg['t_start'], x1=seg['t_end'],
                fillcolor=COLOR_MAP[seg['label']],
                opacity=0.15, line_width=0,
                row=i+1, col=1,
            )
    fig_eeg.update_layout(
        title="Raw EEG (first 4 channels) with predicted segments",
        height=420, margin=dict(l=50, r=20, t=60, b=40),
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#e2e8f0'
    )
    fig_eeg.update_xaxes(title_text="Time (s)", row=len(raw_eeg), col=1)

    # Fig 3: Band power heatmap
    band_cols = list(BANDS.keys())
    z = df[band_cols].values.T
    z_log = np.log1p(z)
    fig_bp = go.Figure(go.Heatmap(
        z=z_log, x=df['t_start'], y=band_cols,
        colorscale='Viridis', colorbar=dict(title="log power"),
    ))
    ictal_mask = df['pred_class'] == 2
    if ictal_mask.any():
        fig_bp.add_trace(go.Scatter(
            x=df.loc[ictal_mask, 't_start'], y=['gamma'] * ictal_mask.sum(),
            mode='markers', marker=dict(symbol='triangle-down', size=8, color='red', opacity=0.7),
            name='Ictal window',
        ))
    fig_bp.update_layout(
        title="Band power heatmap over time",
        xaxis_title="Time (s)", yaxis_title="Band",
        height=300, margin=dict(l=60, r=20, t=50, b=40),
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#e2e8f0'
    )

    # Fig 4: Confidence dist
    fig_conf = go.Figure()
    for cls, col in zip(CLASS_NAMES, CLASS_COLORS):
        subset = df[df['pred_label'] == cls]['confidence']
        if len(subset):
            fig_conf.add_trace(go.Histogram(
                x=subset, name=cls, marker_color=col, opacity=0.7, nbinsx=30,
            ))
    fig_conf.update_layout(
        title="Prediction confidence distribution",
        xaxis_title="Confidence", yaxis_title="Count",
        barmode='overlay', height=300, margin=dict(l=50, r=20, t=50, b=40),
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#e2e8f0'
    )

    # Fig 5: Pie chart
    counts = df['pred_label'].value_counts().reindex(CLASS_NAMES, fill_value=0)
    fig_pie = go.Figure(go.Pie(
        labels=CLASS_NAMES, values=counts.values,
        marker=dict(colors=CLASS_COLORS), hole=0.4, textinfo='label+percent',
    ))
    fig_pie.update_layout(
        title="Window composition", height=300, margin=dict(l=20, r=20, t=50, b=20),
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#e2e8f0'
    )

    # Fig 6: Channel RMS
    fig_ch = go.Figure()
    for cls, col in zip(CLASS_NAMES, CLASS_COLORS):
        sub = df[df['pred_label'] == cls]['channel_rms']
        if len(sub):
            fig_ch.add_trace(go.Box(
                y=sub, name=cls, marker_color=col, boxmean=True,
            ))
    fig_ch.update_layout(
        title="Signal RMS by predicted class",
        yaxis_title="RMS amplitude",
        height=300, margin=dict(l=50, r=20, t=50, b=40),
        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#e2e8f0'
    )

    return {
        "timeline": json.loads(fig_timeline.to_json()),
        "eeg": json.loads(fig_eeg.to_json()),
        "bandpower": json.loads(fig_bp.to_json()),
        "confidence": json.loads(fig_conf.to_json()),
        "pie": json.loads(fig_pie.to_json()),
        "channel": json.loads(fig_ch.to_json()),
    }
