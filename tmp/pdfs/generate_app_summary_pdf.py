from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

OUT_PATH = Path('output/pdf/fall-of-cavalry-app-summary.pdf')
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    'Title',
    parent=styles['Title'],
    fontName='Helvetica-Bold',
    fontSize=17,
    leading=20,
    textColor=colors.HexColor('#1f2937'),
    spaceAfter=8,
)

style_section = ParagraphStyle(
    'Section',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=11,
    leading=13,
    textColor=colors.HexColor('#111827'),
    spaceBefore=5,
    spaceAfter=3,
)

style_body = ParagraphStyle(
    'Body',
    parent=styles['BodyText'],
    fontName='Helvetica',
    fontSize=9.2,
    leading=11.2,
    textColor=colors.HexColor('#111827'),
    spaceAfter=2,
)

style_bullet = ParagraphStyle(
    'Bullet',
    parent=style_body,
    leftIndent=12,
    firstLineIndent=-9,
    spaceAfter=1.6,
)

story = []
story.append(Paragraph('Fall Of Cavalry - App Summary', style_title))
story.append(Paragraph('Source basis: repository files, scripts, and in-repo docs only.', style_body))
story.append(Spacer(1, 0.06 * inch))

story.append(Paragraph('What it is', style_section))
story.append(
    Paragraph(
        'Fall Of Cavalry is a browser-based tactical strategy prototype that runs fully on the client side. It combines world-map exploration, city management, encounter flow, and tactical battles in a single offline web app.',
        style_body,
    )
)

story.append(Paragraph('Who it is for', style_section))
story.append(
    Paragraph(
        'Primary persona: single-player strategy/tactics players and internal playtesters validating game loops. Explicit persona documentation: Not found in repo.',
        style_body,
    )
)

story.append(Paragraph('What it does', style_section))
feature_bullets = [
    'Faction/seed-based start flow that initializes campaign state and world generation.',
    'Map exploration with click-to-move party control, camera zoom/follow, fog of war, and POI interaction.',
    'Encounter pipeline with continue-or-fight branching and roster selection before deployment.',
    'Tactical battle simulation with formations, commands (hold/focus/retreat/skirmish), morale, flanking, and ranged logic.',
    'City services for recruiting units, market trading, healer actions, and contract generation.',
    'Daily economy/accounting ticks for wages, supplies/camp effects, events, and morale/gold outcomes.',
    'Save/load system with autosave + manual slots and JSON export/import.',
]
for bullet in feature_bullets:
    story.append(Paragraph(f'- {bullet}', style_bullet))

story.append(Paragraph('How it works (architecture)', style_section))
arch_bullets = [
    'UI shell: index.html provides a canvas plus HUD/modal overlays; js/main.js bootstraps on DOMContentLoaded.',
    'Core loop: GameState (event bus) + GameLoop emit mode-specific update/render/day/autosave events.',
    'Orchestration: UIManager subscribes to state events and routes to RenderManager, WorldManager, BattleManager, EconomyManager, EncounterManager, SaveManager, and GameFlowManager.',
    'World and battle services: WorldManager delegates to WorldGenManager/WorldSimManager; systems modules implement weather, diplomacy, trade, recruitment, combat, and AI rules.',
    'Persistence/data flow: Input handlers mutate state through managers; SaveManager serializes runtime state and SaveSystem stores slots in browser localStorage. External backend/API services: Not found in repo.',
]
for bullet in arch_bullets:
    story.append(Paragraph(f'- {bullet}', style_bullet))

story.append(Paragraph('How to run (minimal)', style_section))
run_bullets = [
    'Use Node.js 18+ (per package.json engines).',
    'Install dependencies: npm install',
    'Start dev server: npm run dev',
    'Open the Vite URL (default http://localhost:5173).',
]
for bullet in run_bullets:
    story.append(Paragraph(f'- {bullet}', style_bullet))


def draw_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#6b7280'))
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, doc.bottomMargin - 10, 'Page 1/1')
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUT_PATH),
    pagesize=letter,
    leftMargin=0.58 * inch,
    rightMargin=0.58 * inch,
    topMargin=0.52 * inch,
    bottomMargin=0.55 * inch,
    title='Fall Of Cavalry App Summary',
    author='Codex',
)

doc.build(story, onFirstPage=draw_header_footer)
print(str(OUT_PATH.resolve()))
