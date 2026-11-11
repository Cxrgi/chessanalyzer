// Lektionen: eigene Inhalte, aufgebaut wie ein klassischer Schachkurs –
// von den Regeln über Taktik und Mattbilder bis zu Eröffnung und Endspiel.
//
// Schritt-Typen:
//   info    – Erklärung mit Stellung, Pfeilen (arrows) und Markierungen (marks)
//   square  – ein Feld antippen (target)
//   move    – Zug finden: accept (UCI-Liste) und/oder mate: true (jeder Mattzug zählt);
//             mehrzügig über seq: [{ user: [...] | mate, text }, { auto: 'uci' | [Kandidaten] }, …]
//   Bei falschen Zügen: wrong { uci: Text } für gezielte Hinweise, sonst allgemeine Rückmeldung.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const COURSES = [
  {
    id: 'grundlagen',
    title: 'Die Grundlagen',
    desc: 'Brett, Figuren und Regeln – alles, was du für deine erste Partie brauchst.',
    lessons: [
      {
        id: 'brett',
        title: 'Das Schachbrett',
        desc: 'Linien, Reihen und Feldnamen',
        steps: [
          { type: 'info', fen: START, marks: ['h1'], text: 'Das Schachbrett hat 64 Felder – acht mal acht, abwechselnd hell und dunkel. Leg es immer so hin, dass unten rechts ein **helles Feld** ist.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', marks: ['e2', 'e3', 'e4', 'e5', 'e6', 'e7'], text: 'Die senkrechten Spalten heißen **Linien** und tragen die Buchstaben a bis h. Die waagerechten Zeilen heißen **Reihen** und tragen die Zahlen 1 bis 8. Markiert ist die e-Linie.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', marks: ['e4'], text: 'Jedes Feld hat einen Namen aus Linie und Reihe. Das markierte Feld liegt auf der e-Linie in der 4. Reihe – es heißt **e4**.' },
          { type: 'square', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', target: ['d5'], text: 'Jetzt du: Tippe auf das Feld **d5**.', success: 'Richtig – d-Linie, 5. Reihe.' },
          { type: 'square', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', target: ['g2'], text: 'Und jetzt auf **g2**.', success: 'Genau.' },
          { type: 'square', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', target: ['a8'], text: 'Zum Schluss: **a8**.', success: 'Sehr gut – die Feldnamen sitzen.' },
          { type: 'info', fen: START, marks: ['d1', 'd8'], text: 'So stehen die Figuren zu Beginn. **Weiß fängt immer an**, danach wird abwechselnd gezogen. Merkhilfe für den Aufbau: Die Dame steht auf ihrer eigenen Farbe – die weiße Dame auf dem hellen Feld d1, die schwarze auf dem dunklen Feld d8.' },
        ],
      },
      {
        id: 'turm',
        title: 'Der Turm',
        desc: 'Geradeaus, so weit er will',
        steps: [
          { type: 'info', fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', arrows: [['d4', 'd8'], ['d4', 'd1'], ['d4', 'a4'], ['d4', 'h4']], text: 'Der Turm zieht **geradeaus**: waagerecht oder senkrecht, so weit er will.' },
          { type: 'info', fen: '4k3/3p4/8/8/3R4/8/3P4/4K3 w - - 0 1', arrows: [['d4', 'd7']], marks: ['d2'], text: 'Er kann **nicht über Figuren springen**. Der eigene Bauer auf d2 versperrt ihm den Weg nach unten. Eine gegnerische Figur kann er dagegen **schlagen**: Er stellt sich einfach auf ihr Feld.' },
          { type: 'move', fen: '6k1/8/8/8/1R4p1/8/8/4K3 w - - 0 1', accept: ['b4g4'], text: 'Schlage den schwarzen Bauern mit dem Turm.', success: 'Genau! Der Turm zieht auf das Feld des Bauern und nimmt ihn vom Brett.' },
          { type: 'move', fen: '4k3/3p4/8/8/8/3P4/6K1/b2R4 w - - 0 1', accept: ['d1a1'], text: 'Der Bauer auf d7 ist verlockend – aber dein eigener Bauer steht im Weg. Finde die Figur, die der Turm wirklich schlagen kann.', success: 'Richtig, der Läufer in der Ecke war erreichbar.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', text: 'Türme lieben **offene Linien** – also Linien ohne Bauern. Ein Turm ist etwa **5 Bauern** wert.' },
        ],
      },
      {
        id: 'laeufer',
        title: 'Der Läufer',
        desc: 'Immer schräg, immer auf einer Farbe',
        steps: [
          { type: 'info', fen: '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1', arrows: [['d4', 'a1'], ['d4', 'g1'], ['d4', 'a7'], ['d4', 'h8']], text: 'Der Läufer zieht **diagonal**, so weit er will. Deshalb bleibt er sein Leben lang auf Feldern derselben Farbe.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', marks: ['c1', 'f1'], text: 'Jede Seite hat zwei Läufer: einen für die dunklen und einen für die hellen Felder. Zusammen decken sie das ganze Brett ab.' },
          { type: 'move', fen: '4k3/8/5n2/8/8/2B5/8/4K3 w - - 0 1', accept: ['c3f6'], text: 'Schlage den Springer mit dem Läufer.', success: 'Sauber – eine Figur gewonnen.' },
          { type: 'move', fen: '4k3/8/7r/n7/5P2/8/3B4/4K3 w - - 0 1', accept: ['d2a5'], text: 'Auch der Läufer kann nicht springen. Schlage die Figur, die er wirklich erreicht.', success: 'Genau. Der Weg zum Turm war vom eigenen Bauern versperrt.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', text: 'Ein Läufer ist etwa **3 Bauern** wert – genauso viel wie ein Springer.' },
        ],
      },
      {
        id: 'dame',
        title: 'Die Dame',
        desc: 'Die stärkste Figur',
        steps: [
          { type: 'info', fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1', arrows: [['d4', 'd7'], ['d4', 'd1'], ['d4', 'a4'], ['d4', 'h4'], ['d4', 'a1'], ['d4', 'g1'], ['d4', 'a7'], ['d4', 'h8']], text: 'Die Dame ist die stärkste Figur: Sie zieht wie **Turm und Läufer zusammen** – geradeaus und diagonal.' },
          { type: 'move', fen: '6k1/8/8/8/8/2r5/8/Q3K3 w - - 0 1', accept: ['a1c3'], text: 'Schlage den ungedeckten Turm.', success: 'Genau – die Dame schlägt auch diagonal.' },
          { type: 'move', fen: '4k3/8/4p3/3n3b/8/8/8/3QK3 w - - 0 1', accept: ['d1h5'], wrong: { d1d5: 'Vorsicht: Der Springer ist vom Bauern e6 gedeckt. Du würdest die Dame für einen Springer hergeben.' }, text: 'Die Dame kann zwei Figuren schlagen – aber eine davon ist gedeckt. Nimm die richtige!', success: 'Richtig. Der Läufer hing, der Springer war gedeckt.' },
          { type: 'info', fen: START, marks: ['d1'], text: 'Die Dame ist etwa **9 Bauern** wert. Weil sie so wertvoll ist, sollte sie nicht zu früh ins Spiel – sonst wird sie von den kleineren Figuren über das Brett gejagt.' },
        ],
      },
      {
        id: 'springer',
        title: 'Der Springer',
        desc: 'Der Einzige, der springen darf',
        steps: [
          { type: 'info', fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', marks: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'], text: 'Der Springer zieht in **L-Form**: zwei Felder geradeaus und dann eines zur Seite. Von d4 aus erreicht er die acht markierten Felder.' },
          { type: 'info', fen: START, arrows: [['g1', 'f3'], ['b1', 'c3']], text: 'Als einzige Figur darf er **über andere springen**. Deshalb kann er schon im ersten Zug ins Spiel kommen.' },
          { type: 'move', fen: '4k3/8/8/8/5p2/8/4N3/4K3 w - - 0 1', accept: ['e2f4'], text: 'Schlage den Bauern mit dem Springer.', success: 'Genau so sieht ein Springerzug aus.' },
          {
            type: 'move', fen: '7k/8/8/4p3/8/8/8/4K1N1 w - - 0 1', text: 'Der Springer braucht zwei Züge bis zum Bauern auf e5. Finde den Weg!',
            seq: [{ user: ['g1f3'] }, { auto: 'h8g8' }, { user: ['f3e5'], text: 'Und jetzt zuschlagen.' }],
            success: 'Stark – du hast den Weg im Voraus gesehen.',
          },
          { type: 'info', fen: '4k3/8/8/8/3N4/8/8/N3K3 w - - 0 1', marks: ['b3', 'c2'], text: 'Ein Springer ist etwa **3 Bauern** wert. Im Zentrum ist er am stärksten: Dort erreicht er acht Felder, in der Ecke nur zwei. Daher der Spruch: „Springer am Rand bringt Kummer und Schand.“' },
        ],
      },
      {
        id: 'bauer',
        title: 'Der Bauer',
        desc: 'Klein, aber mit eigenen Regeln',
        steps: [
          { type: 'info', fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', arrows: [['e2', 'e3'], ['e2', 'e4']], text: 'Der Bauer zieht nur **vorwärts**, immer ein Feld. Von seinem Startfeld aus darf er auch zwei Felder gehen.' },
          { type: 'info', fen: '4k3/8/8/3p1n2/4P3/8/8/4K3 w - - 0 1', arrows: [['e4', 'd5'], ['e4', 'f5']], text: 'Er **schlägt anders, als er zieht**: ein Feld schräg nach vorn.' },
          { type: 'info', fen: '4k3/8/8/4p3/4P3/8/8/4K3 w - - 0 1', marks: ['e5'], text: 'Steht direkt vor ihm eine Figur, ist der Bauer **blockiert** – geradeaus schlagen kann er nicht.' },
          { type: 'move', fen: '4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1', accept: ['e3d4'], text: 'Schlage den Springer mit dem Bauern.', success: 'Richtig, schräg nach vorn.' },
          { type: 'move', fen: '4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', accept: ['d2d4'], wrong: { d2d3: 'Das ist ein Feld. Vom Startfeld aus darf der Bauer zwei gehen – probier es.' }, text: 'Zieh den Bauern gleich zwei Felder vor.', success: 'Genau. Das geht nur beim ersten Zug dieses Bauern.' },
          { type: 'info', fen: START, text: 'Ein Bauer ist die kleinste Einheit (Wert **1**) – aber er kann **nie zurück**. Überleg dir deshalb jeden Bauernzug gut.' },
        ],
      },
      {
        id: 'koenig',
        title: 'Der König und das Schach',
        desc: 'Die wichtigste Figur beschützen',
        steps: [
          { type: 'info', fen: '7k/8/8/8/3K4/8/8/8 w - - 0 1', arrows: [['d4', 'd5'], ['d4', 'd3'], ['d4', 'c4'], ['d4', 'e4'], ['d4', 'c5'], ['d4', 'e5'], ['d4', 'c3'], ['d4', 'e3']], text: 'Der König zieht **ein Feld in jede Richtung**. Er ist die wichtigste Figur: Um ihn dreht sich die ganze Partie.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/4RK2 b - - 0 1', arrows: [['e1', 'e8']], text: 'Greift eine Figur den König an, heißt das **Schach**. Wer im Schach steht, muss sofort etwas dagegen tun. Dafür gibt es genau drei Möglichkeiten.' },
          { type: 'move', fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', accept: ['e1d1', 'e1d2', 'e1f1', 'e1f2'], text: 'Schwarz gibt Schach. **Möglichkeit 1: wegziehen.** Bring deinen König in Sicherheit.', success: 'Richtig. Auf der e-Linie durfte er nicht bleiben.' },
          { type: 'move', fen: '4r1k1/8/8/8/8/8/3B4/4K3 w - - 0 1', accept: ['d2e3'], wrongDefault: 'Das ist erlaubt – aber hier üben wir das Dazwischenziehen: Stell den Läufer in die Schusslinie.', text: '**Möglichkeit 2: dazwischenziehen.** Stell den Läufer zwischen Turm und König.', success: 'Genau. Der Läufer fängt das Schach ab.' },
          { type: 'move', fen: '4r1k1/8/8/7B/8/8/8/4K3 w - - 0 1', accept: ['h5e8'], wrongDefault: 'Auch das hebt das Schach auf – aber du kannst den Turm einfach schlagen!', text: '**Möglichkeit 3: die Figur schlagen, die Schach gibt.**', success: 'Perfekt – Schach weg und einen Turm gewonnen.' },
          { type: 'info', fen: '8/8/8/3k4/8/3K4/8/8 w - - 0 1', marks: ['c4', 'd4', 'e4'], text: 'Der König darf nie auf ein Feld ziehen, das angegriffen ist. Deshalb können zwei Könige **nie nebeneinander** stehen – die markierten Felder sind für beide tabu.' },
        ],
      },
      {
        id: 'matt',
        title: 'Schachmatt und Patt',
        desc: 'So endet eine Partie',
        steps: [
          { type: 'info', fen: '3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', arrows: [['d8', 'g8']], marks: ['f7', 'g7', 'h7'], text: 'Steht der König im Schach und gibt es **keinen Ausweg** – kein Wegziehen, kein Dazwischenziehen, kein Schlagen –, ist das **Schachmatt**. Die Partie ist sofort vorbei.' },
          { type: 'move', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', mate: true, text: 'Setze matt in einem Zug!', success: 'Schachmatt! Die eigenen Bauern nehmen dem König alle Fluchtfelder.' },
          { type: 'move', fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', mate: true, text: 'Der schwarze König steht in der Ecke. Setze mit der Dame matt!', success: 'Matt. Die Dame steht direkt vor dem König und ist von deinem König gedeckt.' },
          { type: 'info', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', marks: ['g8', 'g7', 'h7'], text: 'Achtung, Falle: Hat der Gegner **keinen legalen Zug** mehr, steht aber **nicht im Schach**, ist das **Patt** – und die Partie endet unentschieden. Hier ist Schwarz am Zug und kann nirgends hin.' },
          { type: 'move', fen: '7k/8/6K1/8/8/8/5Q2/8 w - - 0 1', mate: true, wrong: { f2f7: 'Patt! Schwarz hat keinen Zug mehr, steht aber nicht im Schach – das wäre nur unentschieden.' }, text: 'Du hast eine Dame mehr. Setze matt – und tappe nicht in die Patt-Falle!', success: 'Matt statt Patt. Genau hinschauen lohnt sich.' },
          { type: 'info', fen: START, text: 'Eine Partie endet also durch **Matt** (Sieg), **Patt** (unentschieden), Aufgabe, Zeitüberschreitung oder weil sich beide auf Remis einigen.' },
        ],
      },
      {
        id: 'sonderzuege',
        title: 'Rochade, Umwandlung, en passant',
        desc: 'Die drei Sonderzüge',
        steps: [
          { type: 'info', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', arrows: [['e1', 'g1'], ['h1', 'f1']], text: 'Die **Rochade** ist der einzige Zug, bei dem zwei Figuren ziehen: Der König geht zwei Felder Richtung Turm, der Turm springt über ihn hinweg. So kommt der König in Sicherheit und der Turm ins Spiel.' },
          { type: 'move', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', accept: ['e1g1'], text: 'Rochiere kurz: Zieh den König zwei Felder nach rechts.', success: 'Rochiert! Der Turm ist automatisch mitgesprungen.' },
          { type: 'info', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4', text: 'Rochieren geht nur, wenn **König und Turm noch nicht gezogen** haben, **kein Feld dazwischen besetzt** ist und der König **weder im Schach steht noch über ein angegriffenes Feld zieht**.' },
          { type: 'info', fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', arrows: [['e7', 'e8']], text: 'Erreicht ein Bauer die letzte Reihe, **verwandelt** er sich in eine Figur deiner Wahl – fast immer in eine Dame.' },
          { type: 'move', fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', accept: ['e7e8q'], wrongDefault: 'Erlaubt ist das – aber die Dame ist fast immer die beste Wahl. Versuch es noch einmal und wähle die Dame.', text: 'Zieh den Bauern vor und wähle die Dame.', success: 'Aus dem kleinen Bauern ist die stärkste Figur geworden.' },
          { type: 'info', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', arrows: [['e5', 'd6']], text: 'Der dritte Sonderzug heißt **en passant** („im Vorbeigehen“): Zieht ein gegnerischer Bauer zwei Felder vor und landet direkt neben deinem Bauern, darfst du ihn so schlagen, als wäre er nur ein Feld gegangen – aber nur **sofort im nächsten Zug**.' },
          { type: 'move', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', accept: ['e5d6'], text: 'Schwarz hat gerade d7–d5 gespielt. Schlage en passant!', success: 'Genau. Dein Bauer landet auf d6, der schwarze Bauer verschwindet von d5.' },
        ],
      },
      {
        id: 'wert',
        title: 'Was sind die Figuren wert?',
        desc: 'Gute und schlechte Tauschgeschäfte',
        steps: [
          { type: 'info', fen: START, text: '**Bauer 1 · Springer 3 · Läufer 3 · Turm 5 · Dame 9.** Der König ist unbezahlbar. Mit diesen Werten kannst du bei jedem Tausch nachrechnen, ob er sich lohnt.' },
          { type: 'move', fen: '4k2r/8/8/n7/8/2B5/8/4K3 w - - 0 1', accept: ['c3h8'], wrong: { c3a5: 'Der Springer ist 3 wert, der Turm 5 – nimm lieber den Turm.' }, text: 'Zwei Figuren kannst du schlagen. Nimm die wertvollere!', success: 'Richtig gerechnet: Turm schlägt Springer.' },
          { type: 'move', fen: '6k1/8/3p4/1p2b3/8/2N5/8/4R1K1 w - - 0 1', accept: ['c3b5'], wrong: { e1e5: 'Der Läufer ist vom Bauern d6 gedeckt: Du gibst einen Turm (5) für einen Läufer (3).' }, text: 'Dein Turm könnte den Läufer schlagen – aber der ist gedeckt. Finde den besseren Zug.', success: 'Genau: einen Bauern umsonst gewonnen und dabei den eigenen Springer aus der Schusslinie gebracht.' },
          { type: 'move', fen: '6k1/7p/6p1/5r2/3N4/8/6PP/6K1 w - - 0 1', accept: ['d4f5'], text: 'Hier lohnt sich das Schlagen, obwohl die Figur gedeckt ist. Warum?', success: 'Springer (3) gegen Turm (5) – das nennt man „die Qualität gewinnen“.' },
          { type: 'info', fen: START, text: 'Faustregel: **Tausche, wenn du mehr bekommst, als du gibst.** Und wenn du schon Material mehr hast, vereinfacht jeder gleichwertige Tausch deinen Weg zum Sieg.' },
        ],
      },
    ],
  },
  {
    id: 'taktik',
    title: 'Taktik',
    desc: 'Die Tricks, mit denen Partien entschieden werden.',
    lessons: [
      {
        id: 'haengend',
        title: 'Hängende Figuren',
        desc: 'Ungedeckte Figuren erkennen',
        steps: [
          { type: 'info', fen: 'r3k3/8/8/8/8/5B2/8/4K3 w - - 0 1', arrows: [['f3', 'a8']], text: 'Eine Figur **„hängt“**, wenn sie angegriffen und nicht gedeckt ist. Hängende Figuren darfst du einfach nehmen – und deine eigenen solltest du nie hängen lassen.' },
          { type: 'move', fen: '4k3/pp3ppp/8/3n4/8/8/PPP2PPP/3RK3 w - - 0 1', accept: ['d1d5'], text: 'Eine schwarze Figur hängt. Schlage sie!', success: 'Eine Figur umsonst – das entscheidet oft schon die Partie.' },
          { type: 'move', fen: '4k3/5ppp/p7/1p6/2B5/8/5PPP/6K1 w - - 0 1', accept: ['c4b3', 'c4a2', 'c4d3', 'c4e2', 'c4f1', 'c4d5'], wrongDefault: 'Dein Läufer ist immer noch in Gefahr. Zieh ihn auf ein sicheres Feld.', text: 'Der Bauer b5 greift deinen Läufer an. Rette ihn!', success: 'In Sicherheit. Ein angegriffener Läufer zieht weg – einen Bauern dafür zu nehmen wäre ein schlechtes Geschäft.' },
          { type: 'move', fen: '6k1/5pbp/6p1/8/3N4/8/PPP1PPPP/6K1 w - - 0 1', accept: ['c2c3', 'e2e3'], wrongDefault: 'Hier üben wir das Decken: Stell einen Bauern so, dass er den Springer schützt.', text: 'Der Läufer g7 greift deinen Springer an. Du musst nicht wegziehen – **decke** ihn mit einem Bauern.', success: 'Jetzt wäre Schlagen nur noch ein Tausch: Läufer gegen Springer.' },
          { type: 'info', fen: START, text: 'Stell dir vor **jedem** Zug zwei Fragen: **Hängt bei mir etwas? Hängt beim Gegner etwas?** Allein damit gewinnst du viele Partien.' },
        ],
      },
      {
        id: 'gabel',
        title: 'Die Gabel',
        desc: 'Zwei Figuren auf einmal angreifen',
        steps: [
          { type: 'info', fen: 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1', arrows: [['c7', 'e8'], ['c7', 'a8']], text: 'Bei einer **Gabel** greift eine Figur zwei gegnerische Figuren gleichzeitig an. Der Gegner kann nur eine retten. Hier gabelt der Springer König und Turm.' },
          { type: 'move', fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', accept: ['d5c7'], wrong: { d5f6: 'Das ist zwar Schach – aber der Turm bleibt unbehelligt. Such das Schach, das auch den Turm trifft.' }, text: 'Springergabel! Finde das Schach, das gleichzeitig den Turm angreift.', success: 'Der König muss weichen, danach fällt der Turm.' },
          { type: 'move', fen: '6k1/5ppp/8/2r1n3/8/3P3P/5PPK/8 w - - 0 1', accept: ['d3d4'], text: 'Auch Bauern können gabeln. Greif Turm und Springer gleichzeitig an.', success: 'Eine der beiden Figuren geht verloren – und das für einen Bauern.' },
          { type: 'move', fen: '6k1/5pp1/7p/r7/8/8/5PPP/3Q2K1 w - - 0 1', accept: ['d1d8'], text: 'Die Dame ist eine Gabel-Meisterin. Gib Schach und greif dabei den ungedeckten Turm an.', success: 'Der König muss das Schach beantworten, dann gehört dir der Turm.' },
          { type: 'info', fen: START, text: 'Gabeln entstehen fast immer aus zwei Zutaten: **ungedeckte Figuren** und **Schachgebote**. Halte nach beidem Ausschau.' },
        ],
      },
      {
        id: 'fesselung',
        title: 'Die Fesselung',
        desc: 'Figuren, die nicht wegdürfen',
        steps: [
          { type: 'info', fen: '4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1', arrows: [['b5', 'e8']], marks: ['c6'], text: 'Eine **gefesselte** Figur kann nicht wegziehen, weil dahinter etwas Wertvolleres steht. Steht der König dahinter, ist das Wegziehen sogar verboten.' },
          { type: 'move', fen: '4k3/pp3ppp/2n5/8/8/8/PPP2PPP/4KB2 w - - 0 1', accept: ['f1b5'], text: 'Fessle den Springer an den König.', success: 'Der Springer darf sich jetzt nicht mehr bewegen.' },
          { type: 'move', fen: '4k3/1p3ppp/2n5/1B6/3P4/8/PPP2PPP/4K3 w - - 0 1', accept: ['d4d5'], wrong: { b5c6: 'Das ist nur ein Tausch Läufer gegen Springer. Greif die gefesselte Figur lieber noch einmal an!' }, text: 'Der Springer ist gefesselt und kann nicht fliehen. Greif ihn mit einem Bauern an – so gewinnst du ihn.', success: 'Eine gefesselte Figur mit einem Bauern angreifen: ein Klassiker.' },
          { type: 'move', fen: '4k3/ppp2ppp/8/8/6b1/5N2/PPP2PPP/3QK3 w - - 0 1', accept: ['h2h3'], wrongDefault: 'Hier üben wir, den fesselnden Läufer zu vertreiben: Greif ihn mit einem Bauern an.', text: 'Jetzt ist dein Springer gefesselt – hinter ihm steht die Dame. Vertreibe den Läufer mit einem Bauern.', success: 'Der Läufer muss sich entscheiden: tauschen oder zurückweichen.' },
          { type: 'info', fen: START, text: 'Gefesselte Figuren sind **schlechte Verteidiger** und **leichte Ziele**. Greif sie an – am besten mit einem Bauern.' },
        ],
      },
      {
        id: 'spiess',
        title: 'Der Spieß',
        desc: 'Die Fesselung andersherum',
        steps: [
          { type: 'info', fen: '8/8/8/8/R3k2q/8/8/1K6 b - - 0 1', arrows: [['a4', 'h4']], text: 'Der **Spieß** ist das Gegenstück zur Fesselung: Die wertvollere Figur steht **vorn**. Sie muss ausweichen – und die Figur dahinter fällt.' },
          {
            type: 'move', fen: '8/8/8/8/4k2q/8/8/RK6 w - - 0 1', text: 'Gib Schach mit dem Turm. Der König muss ausweichen – dann gehört dir die Dame.',
            seq: [{ user: ['a1a4'] }, { auto: 'e4d5' }, { user: ['a4h4'], text: 'Der König ist ausgewichen. Jetzt zugreifen!' }],
            success: 'Spieß gelungen: Dame gewonnen.',
          },
          {
            type: 'move', fen: '7r/8/8/4k3/8/8/8/2B1K3 w - - 0 1', text: 'Auch der Läufer kann spießen. Finde das Schach, das den Turm gewinnt.',
            seq: [{ user: ['c1b2'] }, { auto: 'e5e6' }, { user: ['b2h8'], text: 'Und jetzt den Turm einsammeln.' }],
            wrong: { c1f4: 'Dort kann der König den Läufer einfach schlagen. Gib das Schach aus sicherer Entfernung.' },
            success: 'König weg, Turm weg.',
          },
          { type: 'info', fen: START, text: 'Spieße funktionieren mit Turm, Läufer und Dame. Achte auf Könige und Damen, die mit einer anderen Figur **auf einer Linie** stehen.' },
        ],
      },
      {
        id: 'abzug',
        title: 'Abzugsangriff und Abzugsschach',
        desc: 'Zwei Drohungen mit einem Zug',
        steps: [
          { type: 'info', fen: '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1', arrows: [['e1', 'e8']], marks: ['e4'], text: 'Beim **Abzug** zieht eine Figur weg und öffnet dabei die Linie für eine Figur dahinter. Zieht hier der Springer, gibt der Turm Schach – und der Springer darf sich nebenbei ein zweites Ziel suchen.' },
          { type: 'move', fen: '4k3/1q6/8/8/4N3/8/8/4R1K1 w - - 0 1', accept: ['e4d6'], wrong: { e4c5: 'Fast! Aber jetzt kann die Dame einfach auf der e-Linie dazwischenziehen. Finde den Zug, bei dem auch der Springer selbst Schach gibt – gegen ein Doppelschach hilft kein Dazwischenziehen.' }, text: 'Abzugsschach! Zieh den Springer so weg, dass der Turm Schach gibt und der Springer dabei die Dame angreift. Zwei Züge schaffen das – aber nur einer lässt Schwarz keine Ausrede.', success: 'Doppelschach: Der König muss ziehen, danach fällt die Dame.' },
          {
            type: 'move', fen: '3q2k1/5pp1/8/8/8/3B4/8/3R2K1 w - - 0 1', text: 'Dein Läufer verstellt dem Turm den Blick auf die Dame. Zieh ihn mit Schach weg!',
            seq: [{ user: ['d3h7'] }, { auto: 'g8h7' }, { user: ['d1d8'], text: 'Der König hat den Läufer genommen. Was hängt jetzt?' }],
            success: 'Läufer gegeben, Dame gewonnen – ein hervorragendes Geschäft.',
          },
          { type: 'info', fen: START, text: 'Abzüge sind so stark, weil der Gegner **zwei Drohungen** auf einmal bekommt, aber nur **einen Zug** hat.' },
        ],
      },
      {
        id: 'verteidiger',
        title: 'Den Verteidiger beseitigen',
        desc: 'Erst der Beschützer, dann die Beute',
        steps: [
          { type: 'info', fen: '4k3/3n1ppp/8/2b5/6B1/8/5PPP/2R3K1 w - - 0 1', arrows: [['d7', 'c5'], ['c1', 'c5']], text: 'Manchmal hält eine einzige Figur alles zusammen. Hier deckt der Springer d7 den Läufer c5. **Schlägst du den Verteidiger**, hängt die Figur dahinter.' },
          {
            type: 'move', fen: '4k3/3n1ppp/8/2b5/6B1/8/5PPP/2R3K1 w - - 0 1', text: 'Beseitige den Verteidiger – danach holst du dir den Läufer.',
            seq: [{ user: ['g4d7'] }, { auto: 'e8d7' }, { user: ['c1c5'], text: 'Der Beschützer ist weg. Jetzt die Beute.' }],
            wrong: { c1c5: 'Noch ist der Läufer vom Springer gedeckt – du würdest den Turm für einen Läufer geben.' },
            success: 'Unterm Strich hast du eine Figur gewonnen.',
          },
          {
            type: 'move', fen: '5rk1/5ppp/5n2/7Q/8/3B4/6PP/5RK1 w - - 0 1', text: 'Dame und Läufer zielen auf h7 – nur der Springer f6 verhindert das Matt. Räum ihn aus dem Weg!',
            seq: [{ user: ['f1f6'] }, { auto: 'g7f6' }, { user: null, mate: true, text: 'Der Verteidiger ist verschwunden. Setze matt!' }],
            wrong: { h5h7: 'Noch deckt der Springer das Feld h7 – er schlägt deine Dame.' },
            success: 'Erst der Verteidiger, dann das Matt.',
          },
          { type: 'info', fen: START, text: 'Frag dich bei jeder gedeckten Figur: **Wer deckt sie – und kann ich diesen Verteidiger schlagen, ablenken oder vertreiben?**' },
        ],
      },
    ],
  },
  {
    id: 'matt',
    title: 'Mattbilder',
    desc: 'Die wichtigsten Mattmuster, die immer wieder vorkommen.',
    lessons: [
      {
        id: 'grundreihe',
        title: 'Das Grundreihenmatt',
        desc: 'Wenn dem König die Luft fehlt',
        steps: [
          { type: 'info', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', arrows: [['d1', 'd8']], marks: ['f7', 'g7', 'h7'], text: 'Ein rochierter König hinter seinen drei Bauern ist gut geschützt – aber er hat **kein Fluchtfeld**. Dringt ein Turm oder die Dame auf die Grundreihe ein, ist es Matt.' },
          { type: 'move', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', mate: true, text: 'Setze matt!', success: 'Grundreihenmatt – eines der häufigsten Mattbilder überhaupt.' },
          {
            type: 'move', fen: 'r5k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1', text: 'Die Grundreihe ist bewacht – aber nur von einem Turm. Du hast zwei. Setze in zwei Zügen matt!',
            seq: [{ user: ['d2d8'] }, { auto: 'a8d8' }, { user: null, mate: true, text: 'Der Wächter ist abgetauscht. Jetzt der zweite Turm!' }],
            success: 'Zwei Angreifer gegen einen Verteidiger – das reicht.',
          },
          { type: 'move', fen: '4r1k1/R4ppp/8/8/8/8/5PPP/6K1 w - - 0 1', accept: ['h2h3', 'g2g3'], wrongDefault: 'Am sichersten ist ein Luftloch: Zieh den h- oder g-Bauern ein Feld vor.', text: 'Jetzt bist du in Gefahr: Schwarz droht Te1 matt. Schaff deinem König ein **Luftloch**!', success: 'Jetzt hat der König ein Fluchtfeld – die Mattdrohung ist weg.' },
          { type: 'info', fen: START, text: 'Merke: **Schwache Grundreihe = Mattgefahr.** Ein Luftloch (h3 oder g3) kostet nur einen Zug und erspart viel Ärger.' },
        ],
      },
      {
        id: 'damenmatt',
        title: 'Matt mit Dame und König',
        desc: 'Der „Kuss des Todes“',
        steps: [
          { type: 'info', fen: '6k1/6Q1/6K1/8/8/8/8/8 b - - 0 1', arrows: [['g6', 'g7']], text: 'Die Dame allein kann nicht mattsetzen – sie braucht Hilfe. Steht sie **direkt vor dem König und ist gedeckt**, kann er sie nicht schlagen und nirgends hin. Man nennt das den „Kuss des Todes“.' },
          { type: 'move', fen: '3k4/8/3K4/8/8/8/8/7Q w - - 0 1', mate: true, text: 'Dein König nimmt dem schwarzen König die Felder davor. Setze mit der Dame auf der Grundreihe matt!', success: 'Matt. Der eigene König hat die drei Fluchtfelder bewacht.' },
          { type: 'move', fen: '4k3/8/4K3/8/1Q6/8/8/8 w - - 0 1', mate: true, text: 'Hier gibt es sogar zwei Mattzüge. Findest du einen?', success: 'Matt! Egal ob von vorn oder von der Seite – wichtig ist, dass kein Fluchtfeld bleibt.' },
          { type: 'info', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', text: 'Und immer an die **Patt-Falle** denken: Bevor du ziehst, prüf kurz, ob der Gegner danach noch ein Feld hat oder im Schach steht.' },
        ],
      },
      {
        id: 'treppenmatt',
        title: 'Das Treppenmatt',
        desc: 'Matt mit zwei Türmen',
        steps: [
          { type: 'info', fen: '8/8/4k3/R7/1R6/8/8/6K1 w - - 0 1', arrows: [['a5', 'h5'], ['b4', 'b6']], text: 'Zwei Türme setzen ganz ohne Hilfe des Königs matt: Einer **sperrt eine Reihe**, der andere **gibt Schach auf der nächsten**. Stufe für Stufe wird der König an den Rand gedrängt – wie auf einer Treppe.' },
          {
            type: 'move', fen: '8/8/4k3/R7/1R6/8/8/6K1 w - - 0 1', text: 'Der Turm a5 sperrt die 5. Reihe. Gib mit dem anderen Turm Schach auf der 6. Reihe.',
            seq: [
              { user: ['b4b6'] }, { auto: 'e6e7' },
              { user: ['a5a7'], text: 'Der König musste eine Reihe zurück. Jetzt ist der andere Turm dran: Schach auf der 7. Reihe.' }, { auto: 'e7e8' },
              { user: null, mate: true, text: 'Der König steht am Rand. Die letzte Stufe!' },
            ],
            wrong: { a5a6: 'Jetzt entkommt der König über die 5. Reihe. Lass den Turm auf a5 als Sperre stehen und gib mit dem anderen Schach.' },
            success: 'Treppenmatt! Die Türme haben sich abgewechselt wie zwei Füße auf einer Treppe.',
          },
          { type: 'info', fen: START, text: 'Dasselbe Muster funktioniert auch mit **Dame und Turm** oder mit **zwei Damen**. Kommt der König den Türmen zu nahe, zieh sie einfach ans andere Ende des Bretts.' },
        ],
      },
      {
        id: 'schaefermatt',
        title: 'Das Schäfermatt',
        desc: 'Die bekannteste Falle – und wie man sie abwehrt',
        steps: [
          { type: 'info', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', arrows: [['h5', 'f7'], ['c4', 'f7']], text: 'Das **Schäfermatt** ist die bekannteste Anfängerfalle: Dame und Läufer greifen gemeinsam den Bauern **f7** an – den schwächsten Punkt, weil ihn am Anfang nur der König deckt.' },
          { type: 'move', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', mate: true, text: 'Schwarz hat die Drohung übersehen. Setze matt!', success: 'Schäfermatt – nach nur vier Zügen.' },
          { type: 'move', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', accept: ['g7g6', 'd8e7', 'd8f6'], wrong: { g8f6: 'Das greift zwar die Dame an – aber Dxf7 ist Matt!' }, wrongDefault: 'Die Drohung auf f7 besteht noch. Deck das Feld oder vertreib die Dame.', text: 'Jetzt spielst du Schwarz. Weiß droht Matt auf f7. Wehre die Drohung ab!', success: 'Gut verteidigt. f7 ist geschützt.' },
          { type: 'move', fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4', accept: ['g8f6', 'd8e7', 'd8f6'], wrongDefault: 'Auf f7 droht wieder Matt. Stell eine Figur in den Weg.', text: 'Weiß gibt nicht auf und droht noch einmal Matt auf f7. Entwickle eine Figur, die den Weg versperrt.', success: 'Abgewehrt – und du hast dich dabei entwickelt, während Weiß nur mit der Dame herumgezogen ist.' },
          { type: 'info', fen: START, marks: ['f7', 'f2'], text: 'Merke: Die Felder **f7 und f2** sind am Anfang empfindlich. Wer früh mit der Dame angreift, verliert Zeit, wenn der Gegner ruhig verteidigt.' },
        ],
      },
      {
        id: 'erstickt',
        title: 'Das erstickte Matt',
        desc: 'Vom eigenen Gefolge eingemauert',
        steps: [
          { type: 'info', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', arrows: [['g5', 'f7']], text: 'Beim **erstickten Matt** ist der König von seinen eigenen Figuren eingemauert. Dann genügt ein einziges Springerschach – denn einem Springer kann man nichts in den Weg stellen.' },
          { type: 'move', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', mate: true, text: 'Setze matt!', success: 'Ersticktes Matt. Turm und Bauern stehen ihrem eigenen König im Weg.' },
          {
            type: 'move', fen: '5r1k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', text: 'Der berühmteste Trick dazu: Opfere die Dame, um den König einzumauern!',
            seq: [{ user: ['b3g8'] }, { auto: 'f8g8' }, { user: null, mate: true, text: 'Der Turm musste schlagen und steht jetzt seinem König im Weg. Setze matt!' }],
            success: 'Damenopfer und ersticktes Matt – eine der schönsten Kombinationen im Schach.',
          },
          { type: 'info', fen: START, text: 'Mattbilder zu kennen ist wie Vokabeln lernen: Je mehr Muster du gesehen hast, desto schneller erkennst du sie in deinen eigenen Partien.' },
        ],
      },
    ],
  },
  {
    id: 'eroeffnung',
    title: 'Eröffnung',
    desc: 'Wie du gut aus den Startlöchern kommst.',
    lessons: [
      {
        id: 'regeln',
        title: 'Die drei goldenen Regeln',
        desc: 'Zentrum, Entwicklung, Königssicherheit',
        steps: [
          { type: 'info', fen: START, marks: ['d4', 'e4', 'd5', 'e5'], text: 'In der Eröffnung reichen drei einfache Regeln: **1. Besetze das Zentrum. 2. Entwickle deine Figuren. 3. Bring den König in Sicherheit.** Die vier markierten Felder sind das Zentrum.' },
          { type: 'move', fen: START, accept: ['e2e4', 'd2d4'], wrongDefault: 'Am besten gleich mit einem Zentrumsbauern: e4 oder d4.', text: '**Regel 1:** Besetze das Zentrum mit einem Bauern.', success: 'Guter Start. Der Bauer kontrolliert das Zentrum und öffnet Wege für Läufer und Dame.' },
          { type: 'move', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', accept: ['g1f3', 'b1c3'], wrong: { g1h3: 'Springer am Rand bringt Kummer und Schand – stell ihn lieber Richtung Zentrum.', b1a3: 'Am Rand hat der Springer kaum Felder. Stell ihn Richtung Zentrum.' }, wrongDefault: 'Jetzt ist ein Springer dran – Richtung Zentrum.', text: '**Regel 2:** Entwickle einen Springer Richtung Zentrum.', success: 'Der Springer ist im Spiel und zielt auf die Mitte.' },
          { type: 'move', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', accept: ['f1c4', 'f1b5'], wrongDefault: 'Bring jetzt den Königsläufer auf ein aktives Feld.', text: 'Weiter mit der Entwicklung: Bring den Läufer auf ein aktives Feld.', success: 'Der Läufer steht aktiv – und der Weg für die Rochade ist frei.' },
          { type: 'move', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', accept: ['e1g1'], wrongDefault: 'Zwischen König und Turm ist alles frei – Zeit für die Rochade.', text: '**Regel 3:** Bring den König in Sicherheit.', success: 'Rochiert. Nach vier Zügen steht deine Stellung auf sicheren Füßen.' },
          { type: 'info', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4', text: 'Zentrum besetzt, zwei Figuren entwickelt, König sicher. Mit diesen drei Regeln kommst du in fast jeder Partie gut aus der Eröffnung.' },
        ],
      },
      {
        id: 'fehler',
        title: 'Typische Eröffnungsfehler',
        desc: 'Was du am Anfang vermeiden solltest',
        steps: [
          { type: 'info', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', arrows: [['d8', 'h4']], text: 'Die schnellste Niederlage der Schachgeschichte heißt **Narrenmatt**. Weiß hat mit f3 und g4 die Diagonale zu seinem eigenen König geöffnet.' },
          { type: 'move', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', mate: true, text: 'Du spielst Schwarz. Bestrafe den Fehler – Matt in einem Zug!', success: 'Matt nach zwei Zügen. Lehre: Die Bauern vor dem König nicht ohne Grund ziehen.' },
          { type: 'move', fen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3', accept: ['b1c3'], wrongDefault: 'Such einen Entwicklungszug, der gleichzeitig die Dame angreift.', text: 'Schwarz hat seine Dame schon im zweiten Zug herausgebracht. Entwickle eine Figur und greif die Dame dabei an!', success: 'Du entwickelst dich mit Tempo – die Dame muss noch einmal ziehen.' },
          { type: 'move', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', accept: ['d2d3', 'b1c3'], wrongDefault: 'Der Bauer e4 ist angegriffen. Decke ihn mit einem Zug, der auch deine Entwicklung voranbringt.', text: 'Der Springer f6 greift deinen Bauern e4 an. Decke ihn – am besten mit einem Zug, der gleichzeitig deine Entwicklung voranbringt.', success: 'Gedeckt und dabei weiterentwickelt.' },
          { type: 'info', fen: START, text: 'Die häufigsten Eröffnungsfehler: **dieselbe Figur mehrmals ziehen**, **die Dame zu früh herausbringen**, **zu viele Bauernzüge** und **die Rochade vergessen**.' },
        ],
      },
      {
        id: 'italienisch',
        title: 'Die Italienische Partie',
        desc: 'Eine komplette Eröffnung Zug für Zug',
        steps: [
          { type: 'info', fen: START, text: 'Die **Italienische Partie** ist eine der ältesten Eröffnungen – und ideal zum Lernen, weil sie alle drei goldenen Regeln befolgt. Du spielst sie jetzt selbst mit Weiß.' },
          {
            type: 'move', fen: START, text: 'Beginne mit dem Königsbauern: zwei Felder vor.',
            seq: [
              { user: ['e2e4'] }, { auto: 'e7e5' },
              { user: ['g1f3'], text: 'Schwarz antwortet im Zentrum. Entwickle den Königsspringer – er greift gleich den Bauern e5 an.' }, { auto: 'b8c6' },
              { user: ['f1c4'], text: 'Schwarz deckt den Bauern. Jetzt der Läufer: Stell ihn auf c4, wo er auf den schwachen Punkt f7 zielt.' }, { auto: 'f8c5' },
              { user: ['e1g1'], text: 'Schwarz stellt seinen Läufer genauso auf. Zeit, den König in Sicherheit zu bringen.' }, { auto: 'g8f6' },
              { user: ['d2d3'], text: 'Der Springer f6 greift e4 an. Decke den Bauern mit d3 – das öffnet zugleich die Diagonale für deinen zweiten Läufer.' },
            ],
            success: 'Das ist die Italienische Partie. Deine Figuren stehen harmonisch, der König ist sicher.',
          },
          { type: 'info', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 5', arrows: [['c4', 'f7'], ['c1', 'g5']], text: 'Von hier aus geht es ruhig weiter: den zweiten Läufer und den zweiten Springer entwickeln, die Türme ins Spiel bringen. Erst wenn alle Figuren mitspielen, beginnt der Angriff.' },
        ],
      },
    ],
  },
  {
    id: 'endspiel',
    title: 'Endspiel',
    desc: 'Vorteile in Siege verwandeln.',
    lessons: [
      {
        id: 'damenendspiel',
        title: 'Matt mit der Dame',
        desc: 'König und Dame gegen König',
        steps: [
          { type: 'info', fen: '8/8/8/4k3/8/8/1Q6/K7 w - - 0 1', text: 'Mit König und Dame gegen den blanken König gewinnst du immer. Der Plan hat drei Schritte: **1. Den König mit der Dame an den Rand drängen. 2. Den eigenen König heranführen. 3. Mattsetzen – ohne Patt!**' },
          { type: 'move', fen: '4k3/8/8/8/8/8/1Q6/K7 w - - 0 1', accept: ['b2b7', 'b2g7'], wrongDefault: 'Sperr den König auf der letzten Reihe ein: Stell die Dame auf die 7. Reihe.', text: 'Der König steht schon am Rand. Sperr ihn dort ein: Stell die Dame auf die **7. Reihe**.', success: 'Eingesperrt. Der König kann nur noch auf der letzten Reihe hin- und herlaufen.' },
          { type: 'move', fen: '4k3/1Q6/8/3K4/8/8/8/8 w - - 0 1', accept: ['d5d6', 'd5e6'], wrongDefault: 'Die Dame steht perfekt. Jetzt muss dein König näher heran.', text: 'Die Dame hält die Sperre. Führ jetzt deinen **König** heran.', success: 'Der König steht bereit, die Mattfelder zu decken.' },
          { type: 'move', fen: '3k4/1Q6/3K4/8/8/8/8/8 w - - 0 1', mate: true, text: 'Alles ist vorbereitet. Setze matt!', success: 'Matt. Einsperren, König heranführen, mattsetzen – das klappt immer.' },
          { type: 'info', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', text: 'Die einzige Gefahr ist das **Patt**. Lass dem König immer mindestens ein Feld, solange du nicht mattsetzt.' },
        ],
      },
      {
        id: 'turmendspiel',
        title: 'Matt mit dem Turm',
        desc: 'König und Turm gegen König',
        steps: [
          { type: 'info', fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1', arrows: [['a1', 'a8']], text: 'Auch König und Turm gewinnen immer. Das Matt gibt es nur am **Rand** – und nur, wenn die beiden Könige sich **genau gegenüberstehen**. Dann gibt der Turm auf der Randreihe Schach.' },
          { type: 'move', fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1', mate: true, text: 'Die Könige stehen sich gegenüber. Setze matt!', success: 'Matt. Dein König nimmt die drei Felder davor, der Turm die ganze Reihe.' },
          {
            type: 'move', fen: '7k/8/5K2/8/8/8/8/R7 w - - 0 1', text: 'Noch stehen sich die Könige nicht gegenüber. Zieh deinen König so, dass Schwarz danach ins Matt laufen muss.',
            seq: [{ user: ['f6g6', 'f6f7'] }, { auto: ['h8g8', 'h8h7'] }, { user: null, mate: true, text: 'Schwarz hatte nur diesen einen Zug. Jetzt setz matt!' }],
            wrong: { a1a8: 'Das Schach hilft noch nicht – der König entwischt nach h7. Erst den eigenen König heranführen.' },
            success: 'Genau so geht es: erst den König in Stellung bringen, dann das Schach auf dem Rand.',
          },
          { type: 'info', fen: START, text: 'Der Weg dorthin: Der Turm schneidet dem König Reihe für Reihe den Weg ab, dein König drängt ihn zurück. Geduld gehört dazu – Schachs ohne Plan helfen nicht.' },
        ],
      },
      {
        id: 'opposition',
        title: 'König und Bauer: die Opposition',
        desc: 'Wie ein einzelner Bauer zur Dame wird',
        steps: [
          { type: 'info', fen: '8/8/4k3/8/4K3/8/8/8 b - - 0 1', marks: ['e5'], text: 'Im Endspiel wird der König zur Angriffsfigur. Stehen sich die Könige mit **einem Feld Abstand** gegenüber, hat derjenige die **Opposition**, der gerade **nicht** am Zug ist – der andere muss zur Seite weichen.' },
          { type: 'move', fen: '8/4k3/8/8/3K4/8/8/8 w - - 0 1', accept: ['d4e5'], wrongDefault: 'Stell deinen König genau gegenüber – mit einem Feld Abstand.', text: 'Nimm die Opposition: Stell deinen König dem schwarzen genau gegenüber.', success: 'Opposition! Jetzt muss der schwarze König Platz machen.' },
          {
            type: 'move', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', text: 'Dein König steht **vor** dem Bauern auf der 6. Reihe – das gewinnt immer. Geh mit dem König zur Seite und mach dem Bauern Platz.',
            seq: [
              { user: ['e6d6', 'e6f6'] }, { auto: ['e8d8', 'e8f8'] },
              { user: ['e5e6'], text: 'Schwarz stellt sich wieder gegenüber. Jetzt rückt der Bauer nach.' }, { auto: ['d8e8', 'f8e8'] },
              { user: ['e6e7'], text: 'Noch ein Schritt mit dem Bauern!' }, { auto: ['e8f7', 'e8d7'] },
              { user: ['d6d7', 'f6f7'], text: 'Der schwarze König musste weichen. Deck jetzt mit deinem König das Umwandlungsfeld.' }, { auto: ['f7g7', 'd7d6', 'f7g6', 'd7c7'] },
              { user: ['e7e8q'], text: 'Der Weg ist frei – verwandle den Bauern in eine Dame!' },
            ],
            success: 'Umgewandelt! Merke: Der König gehört **vor** den Bauern, nicht dahinter.',
          },
          { type: 'info', fen: START, text: 'Die Faustregel fürs Bauernendspiel: **König nach vorn!** Wer mit dem König vor seinem Bauern die 6. Reihe erreicht, gewinnt.' },
        ],
      },
      {
        id: 'quadrat',
        title: 'Die Quadratregel',
        desc: 'Holt der König den Bauern noch ein?',
        steps: [
          { type: 'info', fen: '8/8/8/8/P6k/8/8/7K w - - 0 1', marks: ['a4', 'b4', 'c4', 'd4', 'e4', 'e5', 'e6', 'e7', 'e8', 'd8', 'c8', 'b8', 'a8', 'a7', 'a6', 'a5'], text: 'Kann der König einen Freibauern noch einholen? Zeichne in Gedanken ein **Quadrat** vom Bauern bis zur Umwandlungsreihe. Steht der gegnerische König außerhalb und kann auch nicht hineinziehen, läuft der Bauer durch.' },
          { type: 'move', fen: '8/8/8/8/P6k/8/8/7K w - - 0 1', accept: ['a4a5'], wrongDefault: 'Keine Zeit verlieren – der Bauer muss laufen.', text: 'Der schwarze König steht außerhalb des Quadrats. Lauf los!', success: 'Der König kommt immer genau einen Schritt zu spät. Der Bauer wird zur Dame.' },
          { type: 'move', fen: '8/8/8/5k2/P7/8/8/7K b - - 0 1', accept: ['f5e6', 'f5e5', 'f5e4'], wrongDefault: 'Das ist außerhalb des Quadrats – der Bauer läuft durch. Zieh auf die e-Linie.', text: 'Jetzt spielst du Schwarz und bist am Zug. Zieh deinen König **ins Quadrat**!', success: 'Im Quadrat. Du holst den Bauern rechtzeitig ein.' },
          { type: 'info', fen: START, text: 'Mit der Quadratregel sparst du dir das Zählen Zug für Zug. Ein Blick genügt: **König im Quadrat – Bauer wird gefangen. König draußen – Bauer läuft durch.**' },
        ],
      },
    ],
  },
];
