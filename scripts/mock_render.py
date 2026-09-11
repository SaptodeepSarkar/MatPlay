# Terminal mockup generator for MatPlay UI documentation.
#
# NOTE: These mockups are stylized references and may not exactly match
# the live app's color scheme (the real app uses cover-art-adaptive
# warm/amber/green palettes — see Shots/ for real screenshots).
#
# Usage: python3 scripts/mock_render.py
# Output: dev/mock-*.png
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_RE = "/usr/share/fonts/TTF/JetBrainsMonoNLNerdFont-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/TTF/JetBrainsMonoNerdFontMono-Bold.ttf"
FONT_SIZE = 12
CHAR_W = 8   # approx char width at FONT_SIZE
CHAR_H = 15  # approx line height at FONT_SIZE

# MatPlay theme colors
BG_DARK = (16, 16, 20)      # main background
BG_SURFACE = (24, 24, 32)   # panel background
BG_ALT = (32, 32, 42)       # nested panel / selected row
BG_HEADER = (20, 20, 28)    # terminal title bar
BG_STATUS = (12, 12, 18)    # bottom status bar
TEXT = (245, 245, 247)
TEXT_DIM = (140, 145, 158)
TEXT_MUTED = (156, 163, 175)
BORDER = (52, 52, 68)
BORDER_DIM = (40, 40, 52)
ACCENT = (187, 134, 252)    # BB86FC
ACCENT2 = (3, 218, 198)     # 03DAC6
RED = (220, 38, 38)
AMBER = (245, 158, 11)

COVER_PATH = "stitch/kalyani-cover.jpg"

def load_font(size=FONT_SIZE, bold=False):
    path = FONT_BOLD if bold else FONT_RE
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def draw_border(draw, x1, y1, x2, y2, color=BORDER, width=1):
    draw.rectangle([x1, y1, x2, y2], outline=color, width=width)


def draw_text(draw, x, y, text, color=TEXT, font=None, bold=False):
    if font is None:
        font = load_font(bold=bold)
    draw.text((x, y), text, fill=color, font=font)
    return font.getlength(text) if hasattr(font, 'getlength') else len(text) * CHAR_W


def terminal_frame(img, title, width=220, height=None):
    """Draw a terminal emulator frame: title bar with controls."""
    draw = ImageDraw.Draw(img)
    ty = 0
    # Title bar
    draw.rectangle([0, 0, width - 1, ty + 22], fill=BG_HEADER)
    draw_text(draw, 28, 5, f"─ {title}", color=TEXT_DIM, font=load_font(10))
    # Window controls (left side, like a TUI)
    controls = ["◄", "▼", "✕"]
    cx = 6
    for c in controls:
        draw_text(draw, cx, 5, c, color=TEXT_MUTED, font=load_font(9))
        cx += 16
    # Separator line under title bar
    draw.line([(0, ty + 22), (width - 1, ty + 22)], fill=BORDER, width=1)
    return ty + 22  # content offset


def draw_status_bar(draw, width, y, text="MatPlay"):
    draw.rectangle([(0, y), (width - 1, y + 18)], fill=BG_STATUS)
    draw.line([(0, y), (width - 1, y)], fill=BORDER, width=1)
    draw_text(draw, 8, y + 3, text, color=ACCENT2, font=load_font(9))


def cover_image(draw, x, y, w, h, path=COVER_PATH):
    """Draw album cover art as a rectangle with thumbnail."""
    try:
        cover = Image.open(path).convert("RGB")
        cover = cover.resize((w, h), Image.LANCZOS)
        img.paste(cover, (x, y))
        # Dark border around cover
        draw.rectangle([x, y, x + w - 1, y + h - 1], outline=BORDER, width=1)
    except Exception:
        # Fallback: solid color block
        draw.rectangle([x, y, x + w - 1, y + h - 1], fill=BG_ALT, outline=BORDER)
        draw_text(draw, x + w // 2 - 20, y + h // 2 - 8, "♪", color=ACCENT, font=load_font(20))


def cava_bars(draw, x, y, width, height, num_bars=32, seed=42):
    """Draw CAVA-style spectrum visualizer bars."""
    import random
    rng = random.Random(seed)
    bar_w = (width - (num_bars - 1) * 2) // num_bars
    gap = 2
    max_h = height
    for i in range(num_bars):
        h = int(rng.randint(5, max_h) * (0.3 + 0.7 * (rng.random())))
        bx = x + i * (bar_w + gap)
        by = y + height - h
        # Color gradient from accent2 (low) to accent (high)
        t = h / max_h
        r = int(ACCENT2[0] * (1 - t) + ACCENT[0] * t)
        g = int(ACCENT2[1] * (1 - t) + ACCENT[1] * t)
        b = int(ACCENT2[2] * (1 - t) + ACCENT[2] * t)
        draw.rectangle([bx, by, bx + bar_w - 1, y + height], fill=(r, g, b))
        # Cap line
        draw.line([(bx, by), (bx + bar_w - 1, by)], fill=(255, 255, 255), width=1)


def seek_bar(draw, x, y, width, progress=0.385):
    """Draw a progress/seek bar."""
    bar_h = 2
    draw.line([(x, y + bar_h // 2), (x + width, y + bar_h // 2)], fill=BORDER, width=1)
    fill_w = int(width * progress)
    draw.line([(x, y + bar_h // 2), (x + fill_w, y + bar_h // 2)], fill=ACCENT, width=2)
    # Knob
    draw.ellipse([x + fill_w - 3, y - 3, x + fill_w + 3, y + 5], fill=ACCENT)


def btn(draw, x, y, w, h, label, color=BG_SURFACE, text_color=TEXT, bold=False, icon=None):
    """Draw a terminal-style button."""
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color, outline=BORDER)
    text_x = x + 4
    if icon:
        draw_text(draw, text_x, y + 2, icon, color=text_color, font=load_font(11))
        text_x += 18
    draw_text(draw, text_x, y + 2, label, color=text_color, font=load_font(10, bold=bold))


def panel(draw, x, y, w, h, color=BG_SURFACE):
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)
    draw.rectangle([x, y, x + w - 1, y + h - 1], outline=BORDER)


# ============================================================
# MOCK 1: Now Playing (Main Screen)
# ============================================================
def mock_now_playing():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — Now Playing", W)

    cx = 20
    cy = offset + 10

    # ┌─ Top: Cover art + metadata ─┐
    cover_w, cover_h = 200, 200
    cover_image(draw, cx, cy, cover_w, cover_h)

    # Metadata
    mx = cx + cover_w + 30
    draw_text(draw, mx, cy, "▸ NOW PLAYING", color=ACCENT, font=load_font(11, bold=True))
    draw_text(draw, mx, cy + 22, "GEOMETRIES OF LIGHT", color=TEXT, font=load_font(16, bold=True))
    draw_text(draw, mx, cy + 42, "VOID STRUCTURE", color=TEXT_MUTED, font=load_font(12))
    draw_text(draw, mx, cy + 60, "FLAC 24-bit / 96kHz  •  LP_01", color=TEXT_DIM, font=load_font(10))

    # Seek bar
    seek_bar(draw, mx, cy + 82, 500, progress=0.385)
    draw_text(draw, mx, cy + 96, "02:14.08", color=TEXT, font=load_font(9))
    draw_text(draw, mx + 120, cy + 96, "05:48.00", color=TEXT_MUTED, font=load_font(9))

    # ┌─ Middle: CAVA visualizer ─┐
    viz_y = cy + 130
    viz_h = 180
    draw.rectangle([cx, viz_y, cx + 900, viz_y + viz_h], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, cx + 10, viz_y + 6, "▓ CAVA SPECTRUM (PRIVATE FIFO FEED)", color=TEXT_DIM, font=load_font(9))
    cava_bars(draw, cx + 10, viz_y + 22, 880, viz_h - 30, num_bars=48, seed=42)

    # ┌─ Bottom: Playback controls ─┐
    ctrl_y = viz_y + viz_h + 20
    btn_w, btn_h = 44, 32
    btn_y = ctrl_y
    center = W // 2
    btn(draw, center - 80, btn_y, btn_w, btn_h, "", color=BG_SURFACE, icon="⏮")
    btn(draw, center - 32, btn_y, btn_w, btn_h, "⏵", color=ACCENT, text_color=BG_DARK, bold=True)
    btn(draw, center + 16, btn_y, btn_w, btn_h, "", color=BG_SURFACE, icon="⏭")

    # Volume meter
    vol_x = center + 80
    draw_text(draw, vol_x, btn_y + 2, "▤ VOL", color=TEXT_DIM, font=load_font(9))
    for i in range(12):
        bar_h = min(4 + i, 10)
        fill = ACCENT if i < 8 else BORDER
        draw.rectangle([vol_x + 30 + i * 5, btn_y + 8 - bar_h, vol_x + 30 + i * 5 + 3, btn_y + 8], fill=fill)
    draw_text(draw, vol_x + 100, btn_y + 2, "-4.2dB", color=TEXT_MUTED, font=load_font(9))

    # ┌─ Bottom status bar ─┐
    draw_status_bar(draw, W, H - 18, f"MatPlay  │  ▶ PLAYING  │  Shuffle: ON  │  Loop: Playlist  │  MPRIS: org.mpris.MediaPlayer2.matplay")

    # ┌─ Left sidebar hint ─┐
    panel(draw, 20, offset + 10 + 310, 140, 200, BG_SURFACE)
    draw_text(draw, 30, offset + 10 + 320, "PLAYLISTS", color=ACCENT, font=load_font(9, bold=True))
    playlists = ["Work", "Chill", "Focus", "Driving", "Late Night"]
    for i, pl in enumerate(playlists):
        color = TEXT if i == 0 else TEXT_DIM
        bg = BG_ALT if i == 0 else BG_SURFACE
        draw.rectangle([24, offset + 10 + 340 + i * 24, 156, offset + 10 + 340 + i * 24 + 20], fill=bg, outline=BORDER_DIM)
        draw_text(draw, 32, offset + 10 + 341 + i * 24, f"  {pl}", color=color, font=load_font(10))

    img.save("dev/mock-now-playing.png", "PNG", optimize=True)
    print("✓ dev/mock-now-playing.png")


# ============================================================
# MOCK 2: Playlist / Library View
# ============================================================
def mock_playlist_view():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — Playlist: Work", W)

    cy = offset + 5
    # Header row
    draw.rectangle([(20, cy), (W - 20, cy + 28)], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, 32, cy + 8, "#", color=ACCENT, font=load_font(9, bold=True))
    draw_text(draw, 50, cy + 8, "TITLE", color=ACCENT, font=load_font(9, bold=True))
    draw_text(draw, 350, cy + 8, "ARTIST", color=ACCENT, font=load_font(9, bold=True))
    draw_text(draw, 580, cy + 8, "ALBUM", color=ACCENT, font=load_font(9, bold=True))
    draw_text(draw, 850, cy + 8, "DURATION", color=ACCENT, font=load_font(9, bold=True))

    # Track rows
    tracks = [
        ("01", "Kalyani", "Kalyani", "Kalyani", "3:42", True),
        ("02", "Aasa Kooda", "Sai Abhyankkar", "Aasa Kooda", "4:15", False),
        ("03", "Mystery of Love", "Sai Abhyankkar", "Aasa Kooda", "3:58", False),
        ("04", "Kalyani (Reprise)", "Kalyani", "Kalyani", "2:55", False),
        ("05", "Ek Do Teen", "Shreya Ghoshal", "Teza", "5:12", False),
        ("06", "Radhe Radhe", "Shreya Ghoshal", "Teza", "4:08", False),
        ("07", "Nainowale Ne", "Arijit Singh", "Padmaavat", "4:33", False),
        ("08", "Ghoomar", "Shreya Ghoshal", "Padmaavat", "4:47", False),
    ]
    for i, (num, title, artist, album, dur, is_current) in enumerate(tracks):
        ry = cy + 32 + i * 32
        row_color = BG_ALT if is_current else BG_SURFACE
        row_text = TEXT if is_current else TEXT_DIM
        indicator = "▸" if is_current else " "
        draw.rectangle([(20, ry), (W - 20, ry + 30)], fill=row_color, outline=BORDER_DIM)
        if is_current:
            draw.rectangle([(20, ry), (23, ry + 30)], fill=ACCENT)
        draw_text(draw, 32, ry + 9, indicator, color=ACCENT if is_current else TEXT_DIM, font=load_font(10))
        draw_text(draw, 50, ry + 9, num, color=row_text, font=load_font(10))
        draw_text(draw, 80, ry + 9, title, color=row_text, font=load_font(10), bold=is_current)
        draw_text(draw, 350, ry + 9, artist, color=row_text, font=load_font(10))
        draw_text(draw, 580, ry + 9, album, color=row_text, font=load_font(10))
        draw_text(draw, 850, ry + 9, dur, color=row_text, font=load_font(10))

    # Bottom info
    draw.rectangle([(20, H - 50), (W - 20, H - 25)], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, 32, H - 42, "8 tracks • 33:20 • Shuffled queue • MPRIS active", color=TEXT_MUTED, font=load_font(10))

    img.save("dev/mock-playlist.png", "PNG", optimize=True)
    print("✓ dev/mock-playlist.png")


# ============================================================
# MOCK 3: Search Overlay
# ============================================================
def mock_search():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — Search", W)

    cy = offset + 10
    # Search box (centered)
    sw = 700
    sx = (W - sw) // 2
    draw.rectangle([(sx, cy), (sx + sw, cy + 42)], fill=BG_SURFACE, outline=ACCENT, width=1)
    draw_text(draw, sx + 14, cy + 10, "/", color=ACCENT, font=load_font(14, bold=True))
    draw_text(draw, sx + 32, cy + 12, "kalyani", color=TEXT, font=load_font(14))
    draw_text(draw, sx + 200, cy + 12, "ESC to close", color=TEXT_DIM, font=load_font(9))

    # Results header
    ry = cy + 56
    draw.rectangle([(sx, ry), (sx + sw, ry + 24)], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, sx + 12, ry + 7, "RESULTS (8)", color=ACCENT, font=load_font(9, bold=True))

    # Result rows
    results = [
        ("Kalyani", "Artist", "Work", "3:42"),
        ("Kalyani", "Track", "Kalyani", "2:55"),
        ("Kalyani (Reprise)", "Track", "Kalyani", "2:55"),
        ("Kalyani", "Album", "Work", "33:20"),
        ("Work", "Playlist", "—", "8 tracks"),
        ("Shreya Ghoshal", "Artist", "—", "42 tracks"),
        ("Kalyani", "Playlist", "—", "12 tracks"),
        ("Kalyani.mp3", "File", "Work/Shreya Ghoshal/Kalyani", "3:42"),
    ]
    for i, (name, rtype, ctx, info) in enumerate(results):
        rx = sx
        ry2 = ry + 28 + i * 30
        fill = BG_ALT if i == 0 else BG_SURFACE
        draw.rectangle([(rx, ry2), (rx + sw, ry2 + 28)], fill=fill, outline=BORDER_DIM)
        draw_text(draw, rx + 12, ry2 + 8, name, color=TEXT if i == 0 else TEXT, font=load_font(11, bold=(i == 0)))
        # Tag pill
        pill_w = len(rtype) * 6 + 12
        draw.rectangle([(sx + sw - 180, ry2 + 6), (sx + sw - 100, ry2 + 20)], fill=BG_ALT, outline=BORDER)
        draw_text(draw, sx + sw - 174, ry2 + 7, rtype.upper(), color=ACCENT2, font=load_font(8))
        draw_text(draw, sx + 12, ry2 + 8, ctx, color=TEXT_DIM, font=load_font(10))
        draw_text(draw, sx + sw - 90, ry2 + 8, info, color=TEXT_MUTED, font=load_font(9))

    # Footer hint
    draw.rectangle([(20, H - 45), (W - 20, H - 25)], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, 32, H - 37, "Search matches title, artist, album, playlist, and file paths • 8 results found", color=TEXT_MUTED, font=load_font(10))

    img.save("dev/mock-search.png", "PNG", optimize=True)
    print("✓ dev/mock-search.png")


# ============================================================
# MOCK 4: Queue View (Shuffle Order)
# ============================================================
def mock_queue():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — Queue (Shuffled)", W)

    cy = offset + 5
    # Queue header
    draw.rectangle([(20, cy), (W - 20, cy + 30)], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, 32, cy + 10, "QUEUED TRACKS (SHUFFLE ORDER)", color=ACCENT, font=load_font(10, bold=True))
    draw_text(draw, W - 200, cy + 10, "3/8", color=TEXT_MUTED, font=load_font(9))

    # Queue rows
    queue = [
        ("01", "Kalyani", "Kalyani", "3:42", "NOW", True),
        ("02", "Mystery of Love", "Sai Abhyankkar", "3:58", "NEXT", False),
        ("03", "Radhe Radhe", "Shreya Ghoshal", "4:08", "NEXT", False),
        ("04", "Ek Do Teen", "Shreya Ghoshal", "5:12", "UP NEXT", False),
        ("05", "Nainowale Ne", "Arijit Singh", "4:33", "UP NEXT", False),
        ("06", "Ghoomar", "Shreya Ghoshal", "4:47", "UP NEXT", False),
        ("07", "Aasa Kooda", "Sai Abhyankkar", "4:15", "UP NEXT", False),
        ("08", "Kalyani (Reprise)", "Kalyani", "2:55", "UP NEXT", False),
    ]
    for i, (num, title, artist, dur, tag, is_current) in enumerate(queue):
        ry = cy + 36 + i * 34
        row_color = BG_ALT if is_current else BG_SURFACE
        row_text = TEXT if is_current else TEXT_DIM
        draw.rectangle([(20, ry), (W - 20, ry + 32)], fill=row_color, outline=BORDER_DIM)
        if is_current:
            draw.rectangle([(20, ry), (23, ry + 32)], fill=ACCENT)
            draw_text(draw, 32, ry + 10, "▸", color=BG_DARK, font=load_font(12, bold=True))
        else:
            draw_text(draw, 32, ry + 10, num, color=TEXT_MUTED, font=load_font(10))
        draw_text(draw, 60, ry + 10, title, color=row_text, font=load_font(11, bold=is_current))
        draw_text(draw, 340, ry + 10, artist, color=row_text, font=load_font(10))
        draw_text(draw, W - 120, ry + 10, dur, color=row_text, font=load_font(10))
        # Tag pill
        tag_color = ACCENT if is_current else ACCENT2
        tag_bg = BG_ALT if is_current else BG_SURFACE
        tw = len(tag) * 6 + 16
        draw.rectangle([(W - 220, ry + 6), (W - 130, ry + 22)], fill=tag_bg, outline=tag_color)
        draw_text(draw, W - 212, ry + 7, tag, color=tag_color, font=load_font(8, bold=True))

    img.save("dev/mock-queue.png", "PNG", optimize=True)
    print("✓ dev/mock-queue.png")


# ============================================================
# MOCK 5: Settings Menu
# ============================================================
def mock_settings():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — Settings", W)

    cy = offset + 10
    sx = (W - 600) // 2

    # Title
    draw_text(draw, sx, cy, "SETTINGS", color=ACCENT, font=load_font(14, bold=True))
    draw_text(draw, sx, cy + 22, "─" * 50, color=BORDER, font=load_font(8))

    settings = [
        ("MUSIC DIRECTORY", "/home/user/Music/Spotify", False, False),
        ("VOLUME", "0.62", False, False),
        ("VIZ GAIN", "1.6", False, False),
        ("VIZ MAX HEIGHT", "0.92", False, False),
        ("THEME", "dark", True, False),
        ("ACCENT COLOR", "#BB86FC", False, False),
        ("SHUFFLE", "ON", True, True),
        ("LOOP PLAYLIST", "ON", True, True),
        ("LOOP SONG", "OFF", True, True),
        ("AUDIO ENGINE", "mpg123 (gapless)", False, False),
        ("CAVA LIVE SPECTRUM", "ENABLED", True, False),
        ("MPRIS PRESENCE", "ACTIVE", True, False),
        ("COVER ART FETCH", "LOCAL", False, False),
        ("AUTO NEXT", "ENABLED", True, False),
    ]

    y = cy + 36
    for label, value, is_toggle, is_active in settings:
        draw.rectangle([(sx, y), (sx + 600, y + 30)], fill=BG_SURFACE, outline=BORDER_DIM)
        draw_text(draw, sx + 12, y + 8, label, color=TEXT_DIM, font=load_font(10, bold=True))
        val_color = ACCENT if is_active else (ACCENT2 if is_toggle else TEXT)
        draw_text(draw, sx + 400, y + 9, value, color=val_color, font=load_font(10, bold=True))
        # Toggle indicator
        if is_toggle:
            dot_color = ACCENT2 if is_active else BORDER
            draw.ellipse([(sx + 570, y + 8), (sx + 582, y + 20)], fill=dot_color)
        y += 34

    # Footer
    draw.rectangle([(20, H - 45), (W - 20, H - 25)], fill=BG_SURFACE, outline=BORDER)
    draw_text(draw, 32, H - 37, "Press ESC to close  •  Changes save automatically  •  Config: ~/.config/matplay/config.json", color=TEXT_DIM, font=load_font(10))

    img.save("dev/mock-settings.png", "PNG", optimize=True)
    print("✓ dev/mock-settings.png")


# ============================================================
# MOCK 6: Lyrics View
# ============================================================
def mock_lyrics():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — Kalyani", W)

    cy = offset + 5

    # Left: cover + controls
    cover_w, cover_h = 180, 180
    cover_image(draw, 30, cy, cover_w, cover_h)
    mx = 30 + cover_w + 24
    draw_text(draw, mx, cy + 4, "▸ KALYANI", color=ACCENT, font=load_font(11, bold=True))
    draw_text(draw, mx, cy + 26, "Kalyani", color=TEXT, font=load_font(14, bold=True))
    draw_text(draw, mx, cy + 46, "Kalyani  •  FLAC 24-bit", color=TEXT_DIM, font=load_font(10))
    seek_bar(draw, mx, cy + 60, 400, progress=0.55)
    draw_text(draw, mx, cy + 76, "03:08.00", color=TEXT, font=load_font(9))
    draw_text(draw, mx + 100, cy + 76, "05:38.00", color=TEXT_MUTED, font=load_font(9))

    btn_w, btn_h = 36, 26
    center = W // 2
    btn(draw, center - 60, cy + 100, btn_w, btn_h, "⏮", color=BG_SURFACE)
    btn(draw, center - 18, cy + 100, btn_w, btn_h, "▮▮", color=ACCENT, text_color=BG_DARK, bold=True)
    btn(draw, center + 24, cy + 100, btn_w, btn_h, "⏭", color=BG_SURFACE)

    # Right: Lyrics panel
    ly_x = 700
    ly_y = cy
    ly_w = W - ly_x - 30
    ly_h = H - cy - 50

    panel(draw, ly_x, ly_y, ly_w, 30, BG_SURFACE)
    draw_text(draw, ly_x + 12, ly_y + 8, "✦ LYRICS", color=ACCENT, font=load_font(10, bold=True))
    draw_text(draw, ly_x + ly_w - 50, ly_y + 8, "lrc", color=TEXT_DIM, font=load_font(9))

    panel(draw, ly_x, ly_y + 32, ly_w, ly_h - 40, BG_SURFACE)

    # Lyrics content — 3-line traveling window
    lines = [
        ("[00:00.00]", "Kalyani Kalyani...", False, False),
        ("[00:04.20]", "Nee ennodu nee...", False, False),
        ("[00:08.50]", "Kalyani Kalyani...", False, False),
        ("[00:12.00]", "Ennoda sollavu...", True, True),   # CURRENT
        ("[00:16.30]", "Kalyaniye Kalyani...", False, False),
        ("[00:20.80]", "Nenapena mage...", False, False),
        ("[00:25.10]", "Bhairavi baare...", False, False),
        ("[00:29.40]", "Kalyani Kalyani...", False, False),
        ("[00:33.00]", "Endhan kanna...", False, False),
    ]
    ly_text_y = ly_y + 40
    for ts, text, is_active, is_window in lines:
        if is_active:
            # Highlight the current line
            draw.rectangle([(ly_x + 4, ly_text_y - 2), (ly_x + ly_w - 4, ly_text_y + 18)], fill=BG_ALT, outline=ACCENT)
            draw_text(draw, ly_x + 12, ly_text_y + 2, text, color=ACCENT, font=load_font(11, bold=True))
        elif is_window:
            draw_text(draw, ly_x + 12, ly_text_y + 2, text, color=TEXT, font=load_font(11))
        else:
            draw_text(draw, ly_x + 12, ly_text_y + 2, text, color=TEXT_MUTED, font=load_font(10))
        ly_text_y += 26

    # Scroll indicator
    draw.rectangle([(ly_x + ly_w - 6, ly_y + 40), (ly_x + ly_w - 2, ly_y + ly_h - 50)], fill=BORDER)
    draw.rectangle([(ly_x + ly_w - 6, ly_y + 70), (ly_x + ly_w - 2, ly_y + 100)], fill=ACCENT)

    img.save("dev/mock-lyrics.png", "PNG", optimize=True)
    print("✓ dev/mock-lyrics.png")


# ============================================================
# MOCK 7: Visualizer Closeup
# ============================================================
def mock_visualizer():
    W, H = 1600, 700
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay — CAVA Spectrum (Private FIFO)", W)

    cy = offset + 5

    # Full-width visualizer
    viz_w = W - 40
    viz_h = H - cy - 40
    draw.rectangle([(20, cy), (W - 20, H - 35)], fill=BG_SURFACE, outline=BORDER)

    # Label
    draw_text(draw, 30, cy + 10, "▓ PRIVATE FIFO FEED — DESKTOP AUDIO NEVER REACHES THIS", color=TEXT_DIM, font=load_font(9))
    draw_text(draw, 30, cy + 24, "CAVA 0.10.7  •  Decoder: mpg123  •  48 bars  •  1.4s cycle", color=ACCENT2, font=load_font(9))

    # Bars
    cava_bars(draw, 30, cy + 40, viz_w - 60, viz_h - 80, num_bars=48, seed=123)

    # Bottom info
    draw.rectangle([(20, H - 40), (W - 20, H - 15)], fill=BG_STATUS, outline=BORDER)
    draw_text(draw, 30, H - 32, "◄ ▲ ▼  ▶ PLAYING  •  32/48 bars active  •  Gain: 1.6x  •  MaxH: 0.92  •  MPRIS: active", color=TEXT_DIM, font=load_font(9))

    img.save("dev/mock-visualizer.png", "PNG", optimize=True)
    print("✓ dev/mock-visualizer.png")


# ============================================================
# MOCK 8: First-run / Empty state
# ============================================================
def mock_first_run():
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    offset = terminal_frame(img, "MatPlay", W)

    cy = offset + 10
    cx = W // 2

    # Center logo
    draw_text(draw, cx - 30, cy + 20, "🎵", color=ACCENT, font=load_font(28), bold=True)
    draw_text(draw, cx - 80, cy + 60, "MatPlay", color=TEXT, font=load_font(22, bold=True))
    draw_text(draw, cx - 140, cy + 92, "Local-first terminal music player", color=TEXT_MUTED, font=load_font(12))

    # First run setup box
    sy = cy + 120
    sw = 500
    sx = cx - sw // 2
    panel(draw, sx, sy, sw, 220, BG_SURFACE)

    steps = [
        ("1", "Select music folder", "Where your playlists live"),
        ("2", "Scan library", "Index all MP3 + lyrics"),
        ("3", "Start playing", "Pick a track or playlist"),
    ]
    for i, (num, title, desc) in enumerate(steps):
        ry = sy + 20 + i * 56
        draw.rectangle([(sx + 16, ry), (sx + sw - 16, ry + 44)], fill=BG_ALT, outline=BORDER_DIM)
        draw_text(draw, sx + 30, ry + 12, num, color=ACCENT, font=load_font(14, bold=True))
        draw_text(draw, sx + 60, ry + 12, title, color=TEXT, font=load_font(12, bold=True))
        draw_text(draw, sx + 60, ry + 30, desc, color=TEXT_MUTED, font=load_font(10))

    # Status bar
    draw_status_bar(draw, W, H - 18, "MatPlay  │  v0.1.0  │  No config found — run installer or npm run dev")

    img.save("dev/mock-first-run.png", "PNG", optimize=True)
    print("✓ dev/mock-first-run.png")


if __name__ == "__main__":
    print("Generating MatPlay UI mockups...")
    print("")
    mock_now_playing()
    mock_playlist_view()
    mock_search()
    mock_queue()
    mock_settings()
    mock_lyrics()
    mock_visualizer()
    mock_first_run()
    print("")
    print("Done! All mockups saved to dev/mock-*.png")
