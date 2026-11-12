// Weiterführende Lektionen für Vereins- und Hobbyspieler:
// sicher spielen, fortgeschrittene Taktik, Strategie, Königsangriff – plus Ergänzungen
// zu Eröffnung und Endspiel. Format wie in lessons-data.js.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Zusätzliche Lektionen für bestehende Kurse (Kurs-ID → Lektionen). */
export const EXTRA = {
  eroeffnung: [
    {
      id: 'spanisch',
      title: 'Die Spanische Partie',
      desc: 'Die Königin der Eröffnungen, Zug für Zug',
      steps: [
        { type: 'info', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', arrows: [['b5', 'c6'], ['f3', 'e5']], text: 'In der **Spanischen Partie** stellt Weiß den Läufer nach b5 statt nach c4. Die Idee: Der Springer c6 deckt den Bauern e5 – und genau diesen Verteidiger nimmt der Läufer aufs Korn. Das erzeugt langfristigen Druck.' },
        {
          type: 'move', fen: START, text: 'Du spielst Weiß. Beginne wie gewohnt mit dem Königsbauern.',
          seq: [
            { user: ['e2e4'] }, { auto: 'e7e5' },
            { user: ['g1f3'], text: 'Greif den Bauern e5 mit dem Springer an.' }, { auto: 'b8c6' },
            { user: ['f1b5'], text: 'Jetzt der spanische Läuferzug: nach b5, mit Blick auf den Verteidiger c6.' }, { auto: 'a7a6' },
            { user: ['b5a4'], text: 'Schwarz fragt den Läufer. Zieh ihn nach a4 zurück – er behält den Springer im Auge.' }, { auto: 'g8f6' },
            { user: ['e1g1'], text: 'Schwarz greift e4 an. Du darfst das ignorieren und rochieren – nimmt er auf e4, holst du dir den Bauern über die e-Linie zurück.' }, { auto: 'f8e7' },
            { user: ['f1e1'], text: 'Jetzt deck den Bauern e4 mit dem Turm. Er steht auf der e-Linie ohnehin gut.' }, { auto: 'b7b5' },
            { user: ['a4b3'], text: 'Der Läufer wird vertrieben. Auf b3 zielt er auf den Punkt f7.' }, { auto: 'd7d6' },
            { user: ['c2c3'], text: 'Zum Schluss c3: Das bereitet d4 vor und gibt dem Läufer ein Rückzugsfeld auf c2.' },
          ],
          success: 'Das ist die Hauptvariante der Spanischen Partie. Weiß plant d4 und spielt geduldig auf Druck im Zentrum.',
        },
        { type: 'info', fen: 'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 b kq - 0 8', arrows: [['d2', 'd4'], ['b3', 'f7']], text: 'Merke dir nicht die Züge, sondern die **Ideen**: Druck auf e5, Läufer nach b3 mit Blick auf f7, Turm nach e1, dann c3 und d4. Wer die Ideen kennt, findet die Züge von selbst.' },
      ],
    },
    {
      id: 'damengambit',
      title: 'Das Damengambit',
      desc: 'Solide Eröffnung mit dem Damenbauern',
      steps: [
        { type: 'info', fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2', arrows: [['c4', 'd5']], text: 'Nach 1. d4 d5 bietet Weiß mit **2. c4** einen Bauern an – das **Damengambit**. Es ist kein echtes Opfer: Nimmt Schwarz auf c4, bekommt Weiß den Bauern fast immer zurück und hat dafür das Zentrum.' },
        {
          type: 'move', fen: START, text: 'Du spielst Weiß. Eröffne diesmal mit dem Damenbauern.',
          seq: [
            { user: ['d2d4'] }, { auto: 'd7d5' },
            { user: ['c2c4'], text: 'Jetzt das Gambit: Greif den Bauern d5 von der Seite an.' }, { auto: 'e7e6' },
            { user: ['b1c3'], text: 'Schwarz lehnt ab und stützt d5. Entwickle den Damenspringer – er erhöht den Druck auf d5.' }, { auto: 'g8f6' },
            { user: ['c1g5'], text: 'Der Springer f6 deckt d5. Fessle ihn mit dem Läufer!' }, { auto: 'f8e7' },
            { user: ['e2e3'], text: 'Sichere das Zentrum mit e3 und öffne den Weg für den Königsläufer.' }, { auto: 'e8g8' },
            { user: ['g1f3'], text: 'Schwarz hat rochiert. Entwickle den zweiten Springer.' },
          ],
          success: 'Das ist das Abgelehnte Damengambit. Weiß steht stabil und hat mehr Raum.',
        },
        { type: 'info', fen: 'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R b KQ - 4 6', text: 'Typisch für d4-Eröffnungen: Der c-Bauer geht **vor** dem Springer nach c4, damit er das Zentrum angreifen kann. Stell den Springer also nicht zu früh nach c3, wenn der Bauer noch auf c2 steht.' },
      ],
    },
    {
      id: 'schwarz',
      title: 'Solide mit Schwarz',
      desc: 'Was du auf 1. e4 antwortest',
      steps: [
        { type: 'info', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', text: 'Auch mit Schwarz gelten die drei goldenen Regeln. Die einfachste und beste Antwort auf 1. e4 ist **1… e5**: Du besetzt selbst das Zentrum und entwickelst dich spiegelbildlich.' },
        {
          type: 'move', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', text: 'Du spielst Schwarz. Antworte im Zentrum.',
          seq: [
            { user: ['e7e5'] }, { auto: 'g1f3' },
            { user: ['b8c6'], text: 'Der Springer greift e5 an. Decke den Bauern mit einem Entwicklungszug.' }, { auto: 'f1c4' },
            { user: ['f8c5'], text: 'Weiß spielt Italienisch. Stell deinen Läufer genauso aktiv auf.' }, { auto: 'c2c3' },
            { user: ['g8f6'], text: 'Entwickle den Königsspringer – er greift gleich den Bauern e4 an.' }, { auto: 'd2d3' },
            { user: ['d7d6'], text: 'Stütze deinen Bauern e5 und öffne die Diagonale für den Damenläufer.' }, { auto: 'e1g1' },
            { user: ['e8g8'], text: 'Und jetzt den König in Sicherheit bringen.' },
          ],
          success: 'Du stehst genauso gut wie Weiß. Mit diesem Aufbau kommst du in jeder e4-Partie sicher ins Mittelspiel.',
        },
        { type: 'info', fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', text: 'Gegen **1. d4** gehst du genauso vor: **1… d5**, dann Sf6, e6, Le7 und Rochade. Ein solider Aufbau, den du nicht auswendig lernen musst.' },
      ],
    },
    {
      id: 'fallen',
      title: 'Eröffnungsfallen',
      desc: 'Zwei berühmte Tricks, die du kennen solltest',
      steps: [
        { type: 'info', fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5', arrows: [['g4', 'd1']], marks: ['f3'], text: 'Der Läufer g4 fesselt deinen Springer an die Dame. Zieht der Springer, fällt die Dame – oder? Beim **Seekadettenmatt** ist genau das der Trick.' },
        {
          type: 'move', fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5', text: 'Schlag trotzdem auf e5 – und lass die Dame stehen!',
          seq: [
            { user: ['f3e5'] }, { auto: 'g4d1' },
            { user: ['c4f7'], text: 'Schwarz hat die Dame genommen. Jetzt kommt die Rechnung: Schach auf f7!' }, { auto: 'e8e7' },
            { user: null, mate: true, text: 'Der König hat nur ein Feld. Setze matt!' },
          ],
          success: 'Seekadettenmatt! Und nimmt Schwarz statt der Dame den Springer, schlägst du einfach den Läufer g4 und hast einen Bauern mehr.',
        },
        { type: 'info', fen: 'rnbqkb1r/pppp1ppp/8/4N3/4n3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4', arrows: [['e4', 'e5']], text: 'Die zweite Falle entsteht in der Russischen Verteidigung. Schwarz hat deinen Springerzug einfach nachgemacht und auf e4 geschlagen. Das sieht logisch aus – ist aber ein Fehler, weil sein König auf der e-Linie steht.' },
        {
          type: 'move', fen: 'rnbqkb1r/pppp1ppp/8/4N3/4n3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4', text: 'Stell die Dame auf die e-Linie und greif den Springer an.',
          seq: [
            { user: ['d1e2'] }, { auto: 'e4f6' },
            { user: ['e5c6'], text: 'Der Springer ist weggezogen. Jetzt zieh deinen Springer mit Abzugsschach weg – und zwar so, dass er die Dame angreift.' }, { auto: 'd8e7' },
            { user: ['c6e7'], text: 'Schwarz muss das Schach abfangen. Nimm die Dame!' },
          ],
          success: 'Dame gewonnen. Merke: Züge nachmachen ist kein Plan – irgendwann geht es schief.',
        },
        { type: 'info', fen: START, text: 'Fallen sind kein Ersatz für gute Entwicklung. Aber wer die bekanntesten Muster kennt, fällt selbst nicht hinein – und nimmt das Geschenk mit, wenn der Gegner patzt.' },
      ],
    },
  ],
  endspiel: [
    {
      id: 'aussenbauer',
      title: 'Der entfernte Freibauer',
      desc: 'Den König weglocken und auf der anderen Seite gewinnen',
      steps: [
        { type: 'info', fen: '8/8/3k2p1/5p2/P2K1P2/6P1/8/8 w - - 0 1', arrows: [['a4', 'a8']], marks: ['f5', 'g6'], text: 'Ein Freibauer weit weg von den übrigen Bauern ist ein **Köder**: Der gegnerische König muss ihn aufhalten – und lässt dabei seine anderen Bauern im Stich. Dein König spaziert dann auf die verlassene Seite.' },
        {
          type: 'move', fen: '8/8/3k2p1/5p2/P2K1P2/6P1/8/8 w - - 0 1', text: 'Schick den a-Bauern los. Der schwarze König muss hinterher.',
          seq: [
            { user: ['a4a5'] }, { auto: 'd6c6' },
            { user: ['d4e5'], text: 'Der König läuft zum a-Bauern. Kümmere dich nicht darum – dein König geht auf die andere Seite!' }, { auto: 'c6b5' },
            { user: ['e5f6'], text: 'Weiter zu den schwarzen Bauern.' }, { auto: 'b5a5' },
            { user: ['f6g6'], text: 'Schwarz hat den Köder geschluckt. Jetzt hol dir die Bauern.' },
          ],
          success: 'Der schwarze König steht weit weg. Du nimmst noch den Bauern f5 und führst deinen eigenen Bauern zur Dame.',
        },
        { type: 'info', fen: START, text: 'Deshalb gilt im Endspiel: **Ein entfernter Freibauer ist oft schon der Gewinn.** Und umgekehrt: Lass den Gegner keinen bekommen.' },
      ],
    },
    {
      id: 'lucena',
      title: 'Turmendspiel: die Brücke',
      desc: 'Die wichtigste Gewinnstellung (Lucena)',
      steps: [
        { type: 'info', fen: '3K4/3P2k1/8/8/8/8/r7/5R2 w - - 0 1', marks: ['d7'], arrows: [['f1', 'f4']], text: 'Turmendspiele kommen häufiger vor als alle anderen. Diese Stellung musst du kennen: Dein Bauer steht kurz vor der Umwandlung, aber dein König steckt davor fest. Sobald er herauskommt, hagelt es Turmschachs. Die Lösung heißt **Brückenbau**.' },
        {
          type: 'move', fen: '3K4/3P2k1/8/8/8/8/r7/5R2 w - - 0 1', text: 'Stell den Turm auf die 4. Reihe. Dort wird er später die Schachs abfangen.',
          seq: [
            { user: ['f1f4'] }, { auto: 'a2a1' },
            { user: ['d8e7'], text: 'Jetzt kommt der König heraus – der Bauer d7 bleibt gedeckt.' }, { auto: 'a1e1' },
            { user: ['e7d6'], text: 'Schach. Geh dem Turm entgegen und halte den Bauern gedeckt.' }, { auto: 'e1d1' },
            { user: ['d6e6'], text: 'Wieder Schach. Zurück auf die e-Linie.' }, { auto: 'd1e1' },
            { user: ['e6d5'], text: 'Noch ein Schach. Jetzt auf die 5. Reihe – dann steht der Turm bereit.' }, { auto: 'e1d1' },
            { user: ['f4d4'], text: 'Jetzt die Brücke: Stell den Turm dazwischen!' },
          ],
          wrongDefault: 'Halt dich an den Plan: Turm auf die 4. Reihe, König heraus, den Schachs entgegenlaufen und am Ende mit dem Turm dazwischenziehen.',
          success: 'Die Brücke steht. Die Schachs sind vorbei, der Bauer wird zur Dame.',
        },
        { type: 'info', fen: START, text: 'Merke dir das Bild: **Turm auf die 4. Reihe, König im Zickzack heraus, Turm dazwischen.** Mit dieser einen Technik gewinnst du viele Turmendspiele mit Mehrbauern.' },
      ],
    },
    {
      id: 'philidor',
      title: 'Turmendspiel: richtig verteidigen',
      desc: 'Mit einem Bauern weniger Remis halten (Philidor)',
      steps: [
        { type: 'info', fen: '4k3/7R/r7/3KP3/8/8/8/8 w - - 0 1', arrows: [['a6', 'h6']], marks: ['e8'], text: 'Du hast einen Bauern weniger – trotzdem ist das Remis. Die Regel: Dein **König steht vor dem Bauern**, dein **Turm bewacht die 6. Reihe**. So kann der weiße König nicht nach vorn.' },
        { type: 'move', fen: '4k3/7R/r3P3/3K4/8/8/8/8 b - - 0 1', accept: ['a6a1', 'a6a2', 'a6a3'], wrongDefault: 'Der Bauer steht jetzt auf der 6. Reihe – der weiße König hat kein Versteck mehr davor. Geh mit dem Turm ganz nach hinten und gib von dort Schach.', text: 'Du spielst Schwarz. Weiß hat den Bauern auf die 6. Reihe vorgerückt, um deinen Turm zu vertreiben. Jetzt ist der Moment: **Turm nach hinten!**', success: 'Von hinten gibst du pausenlos Schach. Der weiße König findet vor seinem eigenen Bauern kein Versteck mehr – Remis.' },
        { type: 'info', fen: START, text: 'Die Verteidigung in zwei Sätzen: **Turm auf die 6. Reihe, bis der Bauer dorthin vorrückt. Dann Turm nach hinten und Schach geben.** Damit hältst du viele scheinbar verlorene Endspiele.' },
      ],
    },
  ],
};

/** Neue Kurse. */
export const MORE_COURSES = [
  {
    id: 'praxis',
    title: 'Sicher spielen',
    desc: 'Weniger Patzer – der schnellste Weg zu mehr Punkten.',
    lessons: [
      {
        id: 'check',
        title: 'Der Sicherheits-Check',
        desc: 'Drei Fragen vor jedem Zug',
        steps: [
          { type: 'info', fen: START, text: 'Die meisten Amateurpartien werden nicht durch geniale Züge entschieden, sondern durch **Patzer**. Ein kurzer Check vor jedem Zug verhindert die meisten davon: **1. Was droht mein Gegner? 2. Welche Schachs und Schlagzüge gibt es? 3. Hängt nach meinem Zug etwas?**' },
          { type: 'move', fen: '4r1k1/1p3ppp/8/8/8/1Q6/5PPP/6K1 w - - 0 1', accept: ['h2h3', 'g2g3', 'h2h4', 'g2g4', 'f2f3', 'f2f4', 'g1f1', 'b3d1', 'b3b1', 'b3b4', 'b3c3'], wrong: { b3b7: 'Te1 matt! Der Bauer war vergiftet – deine Grundreihe ist ungeschützt.' }, wrongDefault: 'Prüf noch einmal: Schwarz spielt Te1+ – das kostet dich die Partie oder die Dame. Gib dem König ein Luftloch oder deck das Feld e1.', text: 'Der Bauer b7 hängt. Aber zuerst Frage 1: **Was droht Schwarz?** Finde einen Zug, der die Gefahr beseitigt.', success: 'Gefahr erkannt, Gefahr gebannt. Den Bauern kannst du dir danach immer noch holen.' },
          { type: 'move', fen: '6k1/5ppp/8/8/1n6/8/PP1P1PPP/R3KB2 w Q - 0 1', accept: ['f1d3', 'e1d1', 'a1c1', 'e1e2', 'a1b1', 'a1d1', 'e1c1'], wrong: { a2a3: 'Der Springer zieht nicht weg, sondern springt nach c2: Schach und Angriff auf den Turm – eine Gabel.' }, wrongDefault: 'Schwarz droht Sc2+ mit Gabel auf König und Turm. Deck das Feld c2 oder nimm ein Ziel aus der Gabel.', text: 'Wieder Frage 1: Was will der Springer auf b4? Vereitle seinen Plan.', success: 'Die Gabel ist verhindert. Wer die Drohung sieht, hat das Problem schon halb gelöst.' },
          { type: 'info', fen: START, text: 'Mach den Check zur **Gewohnheit** – auch in Blitzpartien, auch wenn die Stellung harmlos aussieht. Welche Fehler dir am häufigsten passieren, siehst du übrigens in der Partieanalyse unter „Lernpunkte“.' },
        ],
      },
      {
        id: 'drohungen',
        title: 'Drohungen richtig beantworten',
        desc: 'Ruhig bleiben und die beste Abwehr finden',
        steps: [
          { type: 'info', fen: '5rk1/2b2ppp/3q4/8/8/8/3NQPPP/5RK1 w - - 0 1', arrows: [['d6', 'h2']], text: 'Dame und Läufer stehen hintereinander auf einer Diagonale – eine **Batterie**. Sie zielt auf h2. Solche Aufstellungen solltest du erkennen, bevor es einschlägt.' },
          { type: 'move', fen: '5rk1/2b2ppp/3q4/8/8/8/3NQPPP/5RK1 w - - 0 1', accept: ['d2f3', 'g2g3', 'f2f4', 'e2h5'], wrong: { h2h3: 'Das hilft nicht: Die Dame zieht trotzdem nach h2 – und das ist Matt, weil der Läufer sie deckt.' }, wrongDefault: 'Schwarz droht Dxh2 matt. Deck das Feld h2 oder stell etwas in die Diagonale.', text: 'Schwarz droht Matt auf h2. Wehre die Drohung ab.', success: 'Abgewehrt. Am besten sind Abwehrzüge, die zugleich etwas Nützliches tun – etwa eine Figur entwickeln.' },
          { type: 'move', fen: '6k1/5ppp/8/8/3q4/8/6PP/2B2RK1 w - - 0 1', accept: ['g1h1', 'f1f2'], wrong: { c1e3: 'Der Läufer geht verloren: Die Dame schlägt ihn einfach.' }, text: 'Du stehst im Schach. Drei Antworten gibt es immer – wegziehen, dazwischenziehen, schlagen. Wähle eine, die **nichts kostet**.', success: 'Richtig. Dazwischenziehen ist nur gut, wenn die Figur dort auch gedeckt ist.' },
          { type: 'info', fen: START, text: 'Auf eine Drohung gibt es fünf Antworten: **wegziehen, decken, dazwischenziehen, den Angreifer schlagen – oder eine stärkere Gegendrohung aufstellen.** Geh sie kurz durch, statt den erstbesten Zug zu spielen.' },
        ],
      },
      {
        id: 'zaehlen',
        title: 'Schlagfolgen zählen',
        desc: 'Lohnt sich das Schlagen?',
        steps: [
          { type: 'info', fen: '4k3/8/5n2/3p4/8/2N5/6B1/4K3 w - - 0 1', arrows: [['c3', 'd5'], ['g2', 'd5'], ['f6', 'd5']], text: 'Ob du eine gedeckte Figur schlagen kannst, lässt sich **zählen**: Hier greifen zwei weiße Figuren den Bauern d5 an, aber nur eine schwarze deckt ihn. **Ein Angreifer mehr als Verteidiger – das Schlagen lohnt sich.**' },
          { type: 'move', fen: '4k3/8/5n2/3p4/8/2N5/6B1/4K3 w - - 0 1', accept: ['c3d5', 'g2d5'], text: 'Zwei Angreifer, ein Verteidiger. Hol dir den Bauern!', success: 'Nach dem Abtausch auf d5 bleibt dir ein Bauer mehr.' },
          { type: 'move', fen: '4k3/p7/4pn2/3p4/8/2N5/8/R2RK3 w - - 0 1', accept: ['a1a7'], wrong: { c3d5: 'Zähl nach: zwei Angreifer (Springer, Turm) gegen zwei Verteidiger (Springer, Bauer). Bei Gleichstand verlierst du am Ende Material.', d1d5: 'Der Bauer ist zweimal gedeckt – du gibst den Turm für einen Bauern.' }, text: 'Zwei Bauern sehen angreifbar aus: d5 und a7. Zähl bei beiden Angreifer und Verteidiger – und nimm den richtigen.', success: 'Der Bauer a7 hatte keinen einzigen Verteidiger. d5 dagegen war ausreichend gedeckt.' },
          { type: 'move', fen: '4k3/8/3p4/4n3/3P4/8/4Q3/4K3 w - - 0 1', accept: ['d4e5'], wrong: { e2e5: 'Die Dame würde vom Bauern d6 geschlagen. Die Reihenfolge zählt: mit der kleinsten Figur zuerst.' }, text: 'Dame und Bauer greifen den Springer an. Womit schlägst du zuerst?', success: 'Immer mit der **kleinsten Figur zuerst** schlagen – dann riskierst du am wenigsten.' },
          { type: 'info', fen: START, text: 'Zwei Regeln fürs Zählen: **1. Du brauchst einen Angreifer mehr, als der Gegner Verteidiger hat. 2. Schlag mit der kleinsten Figur zuerst.** Und zähl auch für den Gegner – so merkst du, welche deiner Figuren zu wenig gedeckt sind.' },
        ],
      },
      {
        id: 'verwerten',
        title: 'Einen Vorteil verwerten',
        desc: 'Mit Mehrmaterial sicher gewinnen',
        steps: [
          { type: 'info', fen: '3qr1k1/5pp1/7p/8/8/8/5PPP/R2QR1K1 w - - 0 1', text: 'Du hast Material mehr – wie gewinnst du jetzt sicher? Die wichtigste Regel: **Tausche Figuren.** Je weniger Figuren auf dem Brett sind, desto schwerer wiegt dein Vorteil und desto weniger Tricks hat der Gegner.' },
          { type: 'move', fen: '3qr1k1/5pp1/7p/8/8/8/5PPP/R2QR1K1 w - - 0 1', accept: ['d1d8', 'e1e8'], wrongDefault: 'Du hast einen Turm mehr. Mach es dir leicht: Tausch Damen oder Türme.', text: 'Du hast einen ganzen Turm mehr. Vereinfache die Stellung!', success: 'Mit jedem Tausch schrumpfen die Chancen des Gegners. Am Ende entscheidet der Mehrturm ganz von allein.' },
          { type: 'info', fen: START, text: 'Die Checkliste für gewonnene Stellungen: **1. Figuren tauschen, Bauern behalten. 2. Den eigenen König sichern, bevor du angreifst. 3. Kein Risiko mehr – der einfachste Weg ist der beste. 4. Auf Patt und Dauerschach achten.**' },
        ],
      },
    ],
  },
  {
    id: 'taktik2',
    title: 'Taktik für Fortgeschrittene',
    desc: 'Kombinationen aus mehreren Motiven.',
    lessons: [
      {
        id: 'ablenkung',
        title: 'Ablenkung und Hinlenkung',
        desc: 'Figuren dorthin zwingen, wo du sie haben willst',
        steps: [
          { type: 'info', fen: 'r5k1/pp3qpp/8/8/8/3B1Q2/5PPP/R5K1 w - - 0 1', arrows: [['g8', 'f7'], ['f3', 'f7']], text: 'Die schwarze Dame wird nur vom König gedeckt. Bei der **Ablenkung** zwingst du genau diesen Verteidiger weg – meist mit einem Opfer, das er annehmen muss.' },
          {
            type: 'move', fen: 'r5k1/pp3qpp/8/8/8/3B1Q2/5PPP/R5K1 w - - 0 1', text: 'Lenk den König von seiner Dame ab!',
            seq: [{ user: ['d3h7'] }, { auto: 'g8h7' }, { user: ['f3f7'], text: 'Der König musste schlagen. Jetzt ist die Dame ungedeckt.' }],
            wrong: { f3f7: 'Das ist nur ein Damentausch. Lenk erst den König ab – dann fällt die Dame umsonst.' },
            success: 'Einen Läufer gegeben, eine Dame gewonnen.',
          },
          { type: 'info', fen: '3q2k1/pp3pp1/8/6N1/8/8/PP3PP1/6KR w - - 0 1', arrows: [['h1', 'h8'], ['g5', 'f7']], text: 'Die **Hinlenkung** ist das Gegenstück: Du lockst eine Figur auf ein Feld, auf dem sie schlecht steht – zum Beispiel den König auf ein Feld, wo ihn eine Gabel trifft.' },
          {
            type: 'move', fen: '3q2k1/pp3pp1/8/6N1/8/8/PP3PP1/6KR w - - 0 1', text: 'Lock den König in die Ecke – dort wartet eine Springergabel.',
            seq: [{ user: ['h1h8'] }, { auto: 'g8h8' }, { user: ['g5f7'], text: 'Der König steht auf h8. Jetzt die Gabel!' }, { auto: ['h8g8', 'h8h7'] }, { user: ['f7d8'], text: 'Und die Dame einsammeln.' }],
            success: 'Turm geopfert, Dame gewonnen. Solche Opfer funktionieren, weil der Gegner keine Wahl hat.',
          },
          { type: 'info', fen: START, text: 'Beide Tricks beginnen mit einem **erzwingenden Zug** – meist einem Schach. Such deshalb immer zuerst nach Schachs und Opfern, auch wenn sie auf den ersten Blick unsinnig aussehen.' },
        ],
      },
      {
        id: 'ueberlastung',
        title: 'Die Überlastung',
        desc: 'Eine Figur kann nicht zwei Aufgaben erfüllen',
        steps: [
          { type: 'info', fen: '4r1k1/5ppp/8/8/4n3/8/5PPP/3RR1K1 w - - 0 1', arrows: [['e8', 'e4']], marks: ['d8'], text: 'Der Turm e8 hat zwei Aufgaben: Er deckt den Springer e4 **und** bewacht die Grundreihe. Eine Figur mit zwei Pflichten ist **überlastet** – nimm ihr eine davon ab, und die andere bricht zusammen.' },
          {
            type: 'move', fen: '4r1k1/5ppp/8/8/4n3/8/5PPP/3RR1K1 w - - 0 1', text: 'Nutze die Überlastung aus: Schlag den Springer!',
            seq: [{ user: ['e1e4'] }, { auto: 'e8e4' }, { user: ['d1d8'], text: 'Der Turm hat die Grundreihe verlassen. Bestrafe das!' }, { auto: 'e4e8' }, { user: null, mate: true, text: 'Der Turm wirft sich dazwischen. Schlag ihn – Matt!' }],
            success: 'Nimmt Schwarz den Turm nicht zurück, hast du einfach einen Springer mehr.',
          },
          {
            type: 'move', fen: 'r2q2k1/5ppp/8/6b1/8/8/4QPPP/R1B3K1 w - - 0 1', text: 'Die schwarze Dame deckt sowohl den Turm a8 als auch den Läufer g5. Schlag eine der beiden Figuren – die andere fällt danach.',
            seq: [{ user: ['c1g5', 'a1a8'] }, { auto: ['d8g5', 'd8a8'] }, { user: ['a1a8', 'c1g5'], text: 'Die Dame musste sich entscheiden. Jetzt nimm die zweite Figur.' }],
            success: 'Die Dame konnte nur eine der beiden Figuren weiter decken.',
          },
          { type: 'info', fen: START, text: 'Such nach Figuren, die **mehr als eine Sache decken**. Das sind die Schwachstellen in der gegnerischen Verteidigung.' },
        ],
      },
      {
        id: 'zwischenzug',
        title: 'Der Zwischenzug',
        desc: 'Nicht automatisch zurückschlagen',
        steps: [
          { type: 'info', fen: '3q2k1/p4pp1/7p/8/8/3B1b2/P4PPP/3Q2K1 w - - 0 1', arrows: [['f3', 'd1']], text: 'Schwarz hat gerade auf f3 geschlagen und greift deine Dame an. Der Reflex sagt: zurückschlagen. Aber oft gibt es vorher einen stärkeren Zug – einen **Zwischenzug**, meist ein Schach, auf den der Gegner erst reagieren muss.' },
          {
            type: 'move', fen: '3q2k1/p4pp1/7p/8/8/3B1b2/P4PPP/3Q2K1 w - - 0 1', text: 'Schlag nicht sofort zurück. Finde das Zwischenschach, das die d-Linie öffnet!',
            seq: [{ user: ['d3h7'] }, { auto: 'g8h7' }, { user: ['d1d8'], text: 'Der Läufer ist weg, die d-Linie ist frei. Wer steht dort ungedeckt?' }],
            wrong: { d1f3: 'Das ist der automatische Zug – und nur ein Tausch. Schau, was passiert, wenn dein Läufer die d-Linie mit Schach räumt.', g2f3: 'Das verliert die Dame: Der Läufer f3 greift sie an.' },
            success: 'Statt eines Tauschs hast du die Dame gewonnen.',
          },
          { type: 'info', fen: START, text: 'Bevor du zurückschlägst, frag dich: **Habe ich ein Schach oder eine stärkere Drohung?** Wenn ja, spiel sie zuerst – das Zurückschlagen läuft dir meistens nicht weg.' },
        ],
      },
      {
        id: 'figurenfang',
        title: 'Figuren fangen',
        desc: 'Wenn eine Figur keine Felder mehr hat',
        steps: [
          { type: 'info', fen: '4k3/1p6/8/n2P4/8/1P1P4/P7/4K3 w - - 0 1', marks: ['b3', 'c4', 'c6', 'b7'], text: 'Eine Figur, die **kein sicheres Feld** mehr hat, muss nur noch angegriffen werden – dann ist sie verloren. Der Springer a5 steht am Rand: Alle vier Felder, auf die er ziehen könnte, sind bewacht oder besetzt.' },
          { type: 'move', fen: '4k3/1p6/8/n2P4/8/1P1P4/P7/4K3 w - - 0 1', accept: ['b3b4'], text: 'Der Springer hat kein Fluchtfeld. Greif ihn an!', success: 'Gefangen. Wohin er auch springt – ein Bauer schlägt ihn.' },
          { type: 'move', fen: '4k3/8/p2p4/1pp5/8/1B6/PPP5/4K3 b - - 0 1', accept: ['c5c4'], text: 'Du spielst Schwarz. Der weiße Läufer steht hinter deiner Bauernkette. Sperr ihn ein!', success: 'Der Läufer kommt nicht mehr heraus. Diese Falle heißt „Arche Noah“ und kommt in der Spanischen Partie vor.' },
          { type: 'move', fen: '4k3/5ppp/8/8/8/8/bPP2PPP/2K5 w - - 0 1', accept: ['b2b3'], text: 'Der schwarze Läufer hat sich einen Bauern auf a2 geholt. Schneide ihm den Rückweg ab!', success: 'Eingesperrt. Dein König spaziert nach b2 und holt ihn ab.' },
          { type: 'info', fen: START, text: 'Vor allem **Läufer, Springer am Rand und Damen auf Bauernraub** werden oft gefangen. Bevor du mit einer Figur tief ins gegnerische Lager gehst: Prüf, ob sie auch wieder herauskommt.' },
        ],
      },
      {
        id: 'mattin2',
        title: 'Matt in zwei Zügen',
        desc: 'Rechnen üben',
        steps: [
          { type: 'info', fen: '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1', text: 'Für ein Matt in zwei Zügen musst du **vorausrechnen**: mein Zug, seine Antwort, mein Mattzug. Fang immer mit den **Schachs** an – sie lassen dem Gegner die wenigsten Antworten. Auch Opfer gehören dazu!' },
          {
            type: 'move', fen: '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1', text: 'Matt in zwei. Welches Schach zwingt den Verteidiger der Grundreihe weg?',
            seq: [{ user: ['e2e8'] }, { auto: 'd8e8' }, { user: null, mate: true }],
            success: 'Damenopfer und Grundreihenmatt. Der Turm musste schlagen und hat die Reihe freigegeben.',
          },
          {
            type: 'move', fen: '6rk/6pp/8/5P1Q/8/5R2/6PP/6K1 w - - 0 1', text: 'Matt in zwei. Der König ist von eigenen Figuren eingeengt – reiß die h-Linie auf!',
            seq: [{ user: ['h5h7'] }, { auto: 'h8h7' }, { user: null, mate: true, text: 'Der König steht auf der offenen h-Linie. Welche Figur gibt das letzte Schach?' }],
            success: 'Dame geopfert, Matt mit dem Turm. Der Bauer f5 hat das Fluchtfeld g6 bewacht.',
          },
          {
            type: 'move', fen: '5rk1/5ppp/8/8/2B5/5Q2/5PPP/4R1K1 w - - 0 1', text: 'Matt in zwei. Dame und Läufer zielen beide auf f7 – und der Turm wartet auf der e-Linie.',
            seq: [{ user: ['f3f7'] }, { auto: 'f8f7' }, { user: null, mate: true, text: 'Der Turm hat geschlagen – und ist jetzt vom Läufer gefesselt. Er kann die Grundreihe nicht mehr decken.' }],
            success: 'Der gefesselte Turm durfte nicht dazwischenziehen. Fesselung und Grundreihenmatt in einer Kombination.',
          },
          { type: 'info', fen: START, text: 'So rechnest du: **Kandidaten sammeln (Schachs, Schlagzüge, Drohungen) – jede Antwort des Gegners prüfen – erst dann ziehen.** Am Anfang ist das mühsam, mit Übung geht es von selbst.' },
        ],
      },
    ],
  },
  {
    id: 'strategie',
    title: 'Strategie',
    desc: 'Was tun, wenn es nichts zu schlagen gibt?',
    lessons: [
      {
        id: 'aktiv',
        title: 'Aktive Figuren',
        desc: 'Offene Linien und die 7. Reihe',
        steps: [
          { type: 'info', fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1', marks: ['d1', 'e1'], text: 'Wenn es keine Taktik gibt, verbessere deine Figuren. Die Grundfrage lautet: **Welche meiner Figuren steht am schlechtesten – und wo stünde sie besser?** Türme zum Beispiel gehören auf **offene Linien**, also Linien ohne Bauern.' },
          { type: 'move', fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1', accept: ['a1d1', 'f1d1', 'a1e1', 'f1e1'], wrongDefault: 'Die d- und die e-Linie sind offen. Stell einen Turm darauf.', text: 'Zwei Linien sind offen. Besetze eine davon mit einem Turm.', success: 'Der Turm kontrolliert jetzt die ganze Linie. Wer eine offene Linie zuerst besetzt, bestimmt dort das Spiel.' },
          { type: 'move', fen: 'r5k1/pp3pp1/7p/8/8/8/PP3PPP/3R2K1 w - - 0 1', accept: ['d1d7'], wrongDefault: 'Du beherrschst die d-Linie. Nutze sie, um in die gegnerische Stellung einzudringen.', text: 'Die offene Linie ist nur der Weg. Das Ziel ist die **7. Reihe** – dring ein!', success: 'Auf der 7. Reihe greift der Turm die Bauern von der Seite an und sperrt den König ein.' },
          { type: 'info', fen: START, text: 'Das gilt für alle Figuren: **Springer ins Zentrum, Läufer auf lange Diagonalen, Türme auf offene Linien, die Dame hinter die Front.** Eine Figur, die nichts tut, fehlt dir im Kampf.' },
        ],
      },
      {
        id: 'vorposten',
        title: 'Vorposten',
        desc: 'Felder, von denen dich kein Bauer vertreibt',
        steps: [
          { type: 'info', fen: '4k3/1p2bppp/p2p4/2p1p3/2P1P3/2N5/PP3PPP/4K3 w - - 0 1', marks: ['d5'], text: 'Ein **Vorposten** ist ein Feld in der gegnerischen Hälfte, das **kein gegnerischer Bauer mehr angreifen kann**. Hier ist es d5: Die schwarzen Bauern auf c5 und e5 sind schon vorbeigezogen. Ein Springer dort steht wie ein Fels.' },
          { type: 'move', fen: '4k3/1p2bppp/p2p4/2p1p3/2P1P3/2N5/PP3PPP/4K3 w - - 0 1', accept: ['c3d5'], text: 'Besetze den Vorposten.', success: 'Von d5 aus strahlt der Springer in beide Flügel – und kein Bauer kann ihn je vertreiben.' },
          { type: 'move', fen: '1n2k3/pp3ppp/4p3/4P3/2N5/8/PP3PPP/4K3 w - - 0 1', accept: ['c4d6'], text: 'Auch hier gibt es ein Loch in der schwarzen Stellung. Dein Bauer e5 stützt es. Spring hinein!', success: 'Ein gedeckter Springer auf der 6. Reihe ist oft so viel wert wie ein Turm.' },
          { type: 'info', fen: START, text: 'Vorposten entstehen durch **Bauernzüge** – denn Bauern können nicht zurück. Überleg dir deshalb vor jedem Bauernzug: Welches Feld gebe ich damit für immer auf?' },
        ],
      },
      {
        id: 'bauernstruktur',
        title: 'Bauernschwächen',
        desc: 'Isolierte, doppelte und rückständige Bauern',
        steps: [
          { type: 'info', fen: '4k3/pp3ppp/5n2/3p4/8/4PN2/PP3PPP/4K3 w - - 0 1', marks: ['d5', 'd4'], text: 'Ein **isolierter Bauer** hat keine Nachbarn mehr, die ihn decken könnten. Er muss von Figuren beschützt werden – und das Feld direkt vor ihm ist ein idealer Platz für deine Figuren, denn kein Bauer kann sie dort angreifen.' },
          { type: 'move', fen: '4k3/pp3ppp/5n2/3p4/8/4PN2/PP3PPP/4K3 w - - 0 1', accept: ['f3d4'], text: 'Stell den Springer auf das Feld vor dem isolierten Bauern.', success: 'Blockiert! Der Bauer kommt nicht mehr vorwärts und bleibt ein dauerhaftes Angriffsziel.' },
          { type: 'info', fen: 'r3k3/pp3ppp/3p4/2p1p3/2P1P3/8/PP3PPP/R3K3 w Q - 0 1', marks: ['d6'], arrows: [['a1', 'd1']], text: 'Ein **rückständiger Bauer** ist hinter seinen Nachbarn zurückgeblieben und kann nicht gefahrlos vorrücken. Steht er auf einer halboffenen Linie, wird er zur Zielscheibe für deine Türme.' },
          { type: 'move', fen: 'r3k3/pp3ppp/3p4/2p1p3/2P1P3/8/PP3PPP/R3K3 w Q - 0 1', accept: ['a1d1', 'e1c1'], wrongDefault: 'Der Bauer d6 steht auf einer halboffenen Linie. Bring den Turm dorthin.', text: 'Nimm den rückständigen Bauern d6 ins Visier.', success: 'Der Turm drückt auf den schwachen Bauern. Schwarz muss Figuren abstellen, um ihn zu decken.' },
          { type: 'info', fen: '4k3/pp3ppp/2p5/2p5/8/8/PPP2PPP/4K3 w - - 0 1', marks: ['c5', 'c6'], text: 'Die dritte Schwäche sind **Doppelbauern**: zwei Bauern derselben Farbe hintereinander. Sie können sich nicht gegenseitig decken und kommen nur schwer voran. Merke: **Schwächen angreifen, eigene Schwächen vermeiden.**' },
        ],
      },
      {
        id: 'freibauer',
        title: 'Freibauern',
        desc: 'Laufen lassen, stützen, blockieren',
        steps: [
          { type: 'info', fen: '6k1/5ppp/8/1P6/8/8/5PPP/6K1 w - - 0 1', arrows: [['b5', 'b8']], text: 'Ein **Freibauer** hat keinen gegnerischen Bauern mehr vor sich oder auf den Nachbarlinien. Nur Figuren können ihn aufhalten. Die Regel lautet: **Freibauern müssen laufen.**' },
          { type: 'move', fen: '6k1/5ppp/8/1P6/8/8/5PPP/6K1 w - - 0 1', accept: ['b5b6'], wrongDefault: 'Keine Zeit verlieren – der schwarze König ist noch weit weg.', text: 'Der schwarze König ist weit weg. Lauf los!', success: 'Der König kommt zu spät. Jeder Schritt des Freibauern zwingt den Gegner zum Reagieren.' },
          { type: 'move', fen: 'r5k1/5pp1/7p/P7/8/8/5PPP/3R2K1 w - - 0 1', accept: ['d1a1'], wrong: { a5a6: 'Jetzt schlägt der schwarze Turm den Bauern einfach. Erst decken!' }, wrongDefault: 'Der Bauer a5 ist angegriffen. Deck ihn mit dem Turm – am besten von hinten.', text: 'Der schwarze Turm greift deinen Freibauern an. Deck ihn – und denk daran: **Türme gehören hinter Freibauern**.', success: 'Hinter dem Bauern gewinnt der Turm mit jedem Schritt an Raum. Vor dem Bauern stünde er sich selbst im Weg.' },
          { type: 'move', fen: '6k1/4bppp/8/8/3p4/8/5PPP/4N1K1 w - - 0 1', accept: ['e1d3'], text: 'Jetzt hat Schwarz den Freibauern. Halte ihn auf: **Blockiere** ihn mit dem Springer.', success: 'Der Springer ist der beste Blockeur: Er hält den Bauern an und wirkt trotzdem in alle Richtungen. Hier steht er sogar auf einem hellen Feld, das der schwarze Läufer nie erreicht.' },
          { type: 'info', fen: START, text: 'Drei Regeln: **Eigene Freibauern laufen lassen. Türme dahinter stellen – auch hinter gegnerische. Gegnerische Freibauern früh blockieren.**' },
        ],
      },
      {
        id: 'laeuferfragen',
        title: 'Guter und schlechter Läufer',
        desc: 'Warum Bauern über den Wert eines Läufers entscheiden',
        steps: [
          { type: 'info', fen: '4k3/3b1p2/4p3/3pP3/3P4/3B4/8/4K3 w - - 0 1', arrows: [['d3', 'h7'], ['d3', 'a6']], text: 'Ein Läufer ist nur so gut wie seine Diagonalen. Stehen die **eigenen Bauern auf seiner Feldfarbe**, läuft er ständig gegen sie – ein **schlechter Läufer**. Stehen sie auf der anderen Farbe, hat er freie Bahn.' },
          { type: 'square', fen: '4k3/3b1p2/4p3/3pP3/3P4/3B4/8/4K3 w - - 0 1', target: ['d7'], text: 'Beide Läufer laufen auf hellen Feldern. Einer davon ist von den eigenen Bauern eingemauert. **Tippe den schlechten Läufer an.**', success: 'Genau. Die schwarzen Bauern stehen auf hellen Feldern und versperren ihrem eigenen Läufer den Weg. Die weißen Bauern stehen auf dunklen Feldern – der weiße Läufer ist frei.' },
          { type: 'info', fen: '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', text: 'Was folgt daraus? **Stell deine Bauern auf die andere Farbe als deinen Läufer. Tausch deinen schlechten Läufer ab, wenn du kannst. Und behalte das Läuferpaar** – zwei Läufer decken beide Farben ab und sind in offenen Stellungen meist stärker als Läufer und Springer.' },
        ],
      },
    ],
  },
  {
    id: 'angriff',
    title: 'Königsangriff',
    desc: 'So bringst du den gegnerischen König in Bedrängnis.',
    lessons: [
      {
        id: 'mitte',
        title: 'Der König in der Mitte',
        desc: 'Unrochierte Könige bestrafen',
        steps: [
          { type: 'info', fen: 'r3k2r/ppp1qppp/8/8/8/8/PPPQ1PPP/R4RK1 w - - 0 1', arrows: [['f1', 'e1']], marks: ['e8', 'e7'], text: 'Ein König, der nicht rochiert hat, steht auf einer Linie, die sich leicht öffnet. **Offene e-Linie plus König in der Mitte** – das ist die Einladung für deine Türme.' },
          { type: 'move', fen: 'r3k2r/ppp1qppp/8/8/8/8/PPPQ1PPP/R4RK1 w - - 0 1', accept: ['f1e1', 'a1e1'], wrongDefault: 'Dame und König stehen auf derselben Linie. Was macht ein Turm daraus?', text: 'König und Dame stehen hintereinander auf der offenen e-Linie. Nutze das aus!', success: 'Die Dame ist gefesselt und geht verloren – sie darf die e-Linie nicht verlassen.' },
          { type: 'info', fen: START, text: 'Steht der gegnerische König noch in der Mitte: **Öffne das Zentrum** (Bauern tauschen), **bring die Türme auf die offenen Linien** und **verhindere die Rochade**. Und umgekehrt: Rochiere selbst früh.' },
        ],
      },
      {
        id: 'laeuferopfer',
        title: 'Das Läuferopfer auf h7',
        desc: 'Der berühmteste Angriff auf die Rochade',
        steps: [
          { type: 'info', fen: 'r1bq1rk1/pp1n1ppp/2n1p3/2bpP3/8/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 1', arrows: [['d3', 'h7'], ['f3', 'g5'], ['d1', 'h5']], text: 'Diese Aufstellung solltest du kennen: **Läufer auf d3, Springer auf f3, Dame kann nach h5** – und der Bauer e5 hat den schwarzen Springer von f6 vertrieben. Dann bewacht nur noch der König den Punkt h7. Das schreit nach einem Opfer.' },
          {
            type: 'move', fen: 'r1bq1rk1/pp1n1ppp/2n1p3/2bpP3/8/3B1N2/PPP2PPP/RNBQ1RK1 w - - 0 1', text: 'Opfere den Läufer auf h7!',
            seq: [
              { user: ['d3h7'] }, { auto: 'g8h7' },
              { user: ['f3g5'], text: 'Der König hat genommen. Jetzt der Springer – mit Schach!' }, { auto: 'h7g8' },
              { user: ['d1h5'], text: 'Der König ist zurückgewichen. Bring die Dame heran: Sie droht Matt auf h7.' },
            ],
            success: 'Schwarz kann das Matt auf h7 nur noch unter großen Verlusten abwenden. Drei Figuren gegen einen einsamen König – das genügt.',
          },
          { type: 'info', fen: START, text: 'Das Opfer klappt, wenn **drei Figuren** mitspielen (Läufer, Springer, Dame) und der Gegner **keinen Verteidiger auf f6** hat. Prüf vor dem Opfern, ob er das Feld g5 oder h7 noch rechtzeitig decken kann.' },
        ],
      },
      {
        id: 'hlinie',
        title: 'Angriff über die h-Linie',
        desc: 'Linien öffnen und eindringen',
        steps: [
          { type: 'info', fen: '5rk1/5pp1/8/7Q/8/8/6P1/6KR w - - 0 1', arrows: [['h1', 'h8']], text: 'Fehlt vor dem rochierten König der h-Bauer, wird die **h-Linie zur Autobahn** für Dame und Turm. Stehen beide dort, ist das Matt meist nicht weit.' },
          { type: 'move', fen: '5rk1/5pp1/8/7Q/8/8/6P1/6KR w - - 0 1', mate: true, text: 'Dame und Turm beherrschen die h-Linie. Setze matt!', success: 'Matt. Der Turm deckt die Dame, und der König hat kein Feld.' },
          {
            type: 'move', fen: '5rk1/5p1p/6pQ/7P/8/8/8/6KR w - - 0 1', text: 'Hier ist die h-Linie noch geschlossen – dein eigener Bauer steht im Weg. Öffne sie!',
            seq: [{ user: ['h5g6'] }, { auto: 'f7g6' }, { user: null, mate: true, text: 'Die Linie ist offen, der Turm deckt jetzt h7. Setze matt!' }],
            wrong: { h6h7: 'Noch ist die Dame auf h7 nicht gedeckt – dein Bauer h5 versperrt dem Turm die Sicht. Öffne erst die Linie.' },
            success: 'Linie geöffnet, Matt gesetzt. Schlägt Schwarz mit dem h-Bauern zurück, setzt die Dame auf h8 matt.',
          },
          { type: 'info', fen: START, text: 'Angriff heißt **Linien öffnen**. Bauern sind dafür die Türöffner: Rück sie vor und tausch sie gegen die Bauern vor dem gegnerischen König. Je mehr Figuren du dann auf die offenen Linien bringst, desto stärker der Angriff.' },
        ],
      },
      {
        id: 'verteidigen',
        title: 'Den eigenen König verteidigen',
        desc: 'Angriffe erkennen und entschärfen',
        steps: [
          { type: 'info', fen: '3q1rk1/3n1ppp/8/8/8/3Q4/2B2PPP/5RK1 b - - 0 1', arrows: [['d3', 'h7']], text: 'Angreifen lernt man schnell – Verteidigen gewinnt Partien. Der erste Schritt: **die Drohung erkennen**. Hier stehen Dame und Läufer hintereinander auf der Diagonale nach h7.' },
          { type: 'move', fen: '3q1rk1/3n1ppp/8/8/8/3Q4/2B2PPP/5RK1 b - - 0 1', accept: ['d7f6', 'g7g6', 'f7f5'], wrong: { h7h6: 'Dh7 matt! Der Bauer hat das Feld freigegeben, statt es zu decken.' }, wrongDefault: 'Weiß droht Dxh7 matt. Stell etwas in die Diagonale oder deck das Feld h7.', text: 'Du spielst Schwarz. Weiß droht Matt auf h7. Finde eine Verteidigung!', success: 'Abgewehrt. Ein Springer auf f6 ist übrigens der beste Leibwächter des rochierten Königs.' },
          { type: 'move', fen: '3q2k1/3n1p1p/6pQ/8/8/5N1P/5PP1/6K1 b - - 0 1', accept: ['d8f8', 'd8f6', 'd7f6', 'd8e7'], wrongDefault: 'Die weiße Dame steht bedrohlich nah, der Springer will nach g5. Biete den Damentausch an, deck g5 oder hol einen Verteidiger nach f6.', text: 'Die weiße Dame hat sich vor deinem König eingenistet, der Springer will nach g5. Entschärfe den Angriff!', success: 'Entschärft. Merke: **Angreifer abtauschen oder Verteidiger heranholen** – beides nimmt dem Angriff die Kraft.' },
          { type: 'info', fen: START, text: 'Die Regeln der Verteidigung: **Bauern vor dem König möglichst nicht ziehen. Angreifer abtauschen. Verteidiger heranholen. Und ruhig bleiben** – viele Angriffe sehen gefährlicher aus, als sie sind.' },
        ],
      },
    ],
  },
];
