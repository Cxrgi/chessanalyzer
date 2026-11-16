// Eröffnungslinien für den Eröffnungstrainer: Hauptvarianten der wichtigsten Eröffnungen.
// side = die Seite, aus deren Sicht die Eröffnung üblicherweise gelernt wird.
export const OPENING_GROUPS = [
  {
    title: 'Offene Spiele (1. e4 e5)',
    items: [
      { id: 'italienisch', name: 'Italienische Partie', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', idea: 'Der Läufer auf c4 zielt auf f7. Mit c3 und später d4 baut Weiß in Ruhe ein starkes Zentrum auf.' },
      { id: 'zweispringer', name: 'Zweispringerspiel (ruhig)', side: 'b', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O O-O', idea: 'Schwarz entwickelt den Springer nach f6 und greift e4 an. Danach kommen Läufer, d6 und die Rochade.' },
      { id: 'fegatello', name: 'Zweispringerspiel mit Sg5', side: 'b', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6', idea: 'Gegen den frühen Angriff auf f7 hilft nur d5! Danach nicht auf d5 zurückschlagen, sondern mit Sa5 den Läufer jagen.' },
      { id: 'evans', name: 'Evans-Gambit', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4', idea: 'Weiß opfert einen Bauern, um mit c3 und d4 schnell das Zentrum zu besetzen und Zeit zu gewinnen.' },
      { id: 'spanisch', name: 'Spanische Partie (geschlossen)', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3', idea: 'Der Läufer auf b5 setzt den Verteidiger von e5 unter Druck. Weiß rochiert schnell und bereitet mit c3 den Vorstoß d4 vor.' },
      { id: 'berliner', name: 'Spanisch: Berliner Verteidigung', side: 'b', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8', idea: 'Schwarz schlägt auf e4 und tauscht früh die Damen. Das Endspiel ist sehr solide – die „Berliner Mauer“.' },
      { id: 'schottisch', name: 'Schottische Partie', side: 'w', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5', idea: 'Weiß öffnet sofort das Zentrum mit d4 und bekommt freies Figurenspiel.' },
      { id: 'vierspringer', name: 'Vierspringerspiel', side: 'w', moves: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6', idea: 'Beide Seiten entwickeln erst alle Springer. Sehr solide und leicht zu lernen.' },
      { id: 'russisch', name: 'Russische Verteidigung', side: 'b', moves: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3', idea: 'Schwarz greift e4 an, statt e5 zu decken. Wichtig: erst d6, dann erst auf e4 schlagen!' },
      { id: 'philidor', name: 'Philidor-Verteidigung', side: 'b', moves: 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O', idea: 'Schwarz deckt e5 mit dem Bauern. Etwas passiv, aber stabil.' },
      { id: 'koenigsgambit', name: 'Königsgambit', side: 'w', moves: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5', idea: 'Weiß opfert den f-Bauern für ein starkes Zentrum und die offene f-Linie. Wild und taktisch.' },
      { id: 'wiener', name: 'Wiener Partie', side: 'w', moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3', idea: 'Erst der Springer nach c3, dann f4 – ein Königsgambit mit mehr Sicherheit.' },
    ],
  },
  {
    title: 'Halboffene Spiele (1. e4, Schwarz antwortet anders)',
    items: [
      { id: 'najdorf', name: 'Sizilianisch: Najdorf', side: 'b', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', idea: 'Schwarz tauscht den c-Bauern gegen den d-Bauern und hat dadurch einen Zentrumsbauern mehr. a6 nimmt den weißen Figuren das Feld b5.' },
      { id: 'drachen', name: 'Sizilianisch: Drachenvariante', side: 'b', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6', idea: 'Der Läufer auf g7 – der „Drache“ – zielt über die lange Diagonale auf den Damenflügel.' },
      { id: 'sweschnikow', name: 'Sizilianisch: Sweschnikow', side: 'b', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6', idea: 'Schwarz vertreibt den Springer mit e5 und nimmt dafür ein Loch auf d5 in Kauf.' },
      { id: 'alapin', name: 'Sizilianisch: Alapin', side: 'w', moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6', idea: 'Mit c3 will Weiß d4 spielen und mit einem Bauern zurückschlagen. Vermeidet die viele Theorie der Hauptvarianten.' },
      { id: 'franz-vorstoss', name: 'Französisch: Vorstoßvariante', side: 'w', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3', idea: 'Weiß gewinnt mit e5 Raum. Schwarz greift die Bauernkette sofort an ihrer Basis d4 an.' },
      { id: 'franz-winawer', name: 'Französisch: Winawer', side: 'b', moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7', idea: 'Schwarz fesselt den Springer und gibt später den Läufer, um Weiß Doppelbauern zu verpassen.' },
      { id: 'caro-klassisch', name: 'Caro-Kann: Klassisch', side: 'b', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7', idea: 'Wie Französisch, aber der Läufer kommt vor e6 nach draußen. Sehr solide.' },
      { id: 'caro-vorstoss', name: 'Caro-Kann: Vorstoßvariante', side: 'b', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5', idea: 'Erst den Läufer nach f5, dann e6 und der Hebel c5 gegen das weiße Zentrum.' },
      { id: 'skandinavisch', name: 'Skandinavische Verteidigung', side: 'b', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5', idea: 'Schwarz greift e4 sofort an. Die Dame geht nach dem Springerangriff nach a5, c6 gibt ihr einen Rückweg.' },
      { id: 'pirc', name: 'Pirc-Verteidigung', side: 'b', moves: 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O', idea: 'Schwarz lässt Weiß das Zentrum und greift es später mit e5 oder c5 an.' },
      { id: 'aljechin', name: 'Aljechin-Verteidigung', side: 'b', moves: 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6', idea: 'Der Springer lockt die weißen Bauern nach vorn, damit sie später angreifbar werden.' },
    ],
  },
  {
    title: 'Geschlossene Spiele (1. d4)',
    items: [
      { id: 'damengambit', name: 'Damengambit (abgelehnt)', side: 'w', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6', idea: 'Weiß greift mit c4 den Zentrumsbauern d5 an. Schwarz stützt ihn mit e6 und entwickelt sich solide.' },
      { id: 'damengambit-angenommen', name: 'Damengambit (angenommen)', side: 'w', moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6', idea: 'Schwarz nimmt den Bauern, kann ihn aber nicht halten. Weiß holt ihn mit e3 und Lxc4 zurück.' },
      { id: 'slawisch', name: 'Slawische Verteidigung', side: 'b', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4', idea: 'Schwarz stützt d5 mit c6 – so bleibt der Weg für den Läufer nach f5 frei.' },
      { id: 'london', name: 'Londoner System', side: 'w', moves: 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3', idea: 'Immer derselbe Aufbau: Läufer nach f4, Bauern auf d4, e3 und c3. Wenig Theorie, sehr beliebt.' },
      { id: 'katalanisch', name: 'Katalanische Eröffnung', side: 'w', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6', idea: 'Damengambit mit Läufer auf g2: Er drückt über die lange Diagonale auf den Damenflügel.' },
      { id: 'koenigsindisch', name: 'Königsindische Verteidigung', side: 'b', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7', idea: 'Schwarz lässt Weiß das Zentrum bauen und schlägt mit e5 zurück. Danach folgt oft ein Angriff am Königsflügel.' },
      { id: 'nimzo', name: 'Nimzo-Indische Verteidigung', side: 'b', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O', idea: 'Der Läufer fesselt den Springer c3 und verhindert so e4. Eine der besten Antworten auf 1. d4.' },
      { id: 'damenindisch', name: 'Damenindische Verteidigung', side: 'b', moves: 'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O', idea: 'Der Läufer kommt nach b7 und kontrolliert von dort das wichtige Feld e4.' },
      { id: 'gruenfeld', name: 'Grünfeld-Indische Verteidigung', side: 'b', moves: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7', idea: 'Schwarz gibt das Zentrum auf und greift es dann mit dem Läufer g7 und c5 an.' },
      { id: 'benoni', name: 'Moderne Benoni', side: 'b', moves: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6', idea: 'Schwarz bekommt eine Bauernmehrheit am Damenflügel und starkes Spiel auf der langen Diagonale.' },
      { id: 'hollaendisch', name: 'Holländische Verteidigung', side: 'b', moves: 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6', idea: 'Mit f5 kämpft Schwarz um das Feld e4 und plant Spiel am Königsflügel.' },
    ],
  },
  {
    title: 'Flankeneröffnungen',
    items: [
      { id: 'englisch', name: 'Englische Eröffnung', side: 'w', moves: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6', idea: 'Weiß greift das Zentrum von der Seite an – wie Sizilianisch mit vertauschten Farben und einem Zug mehr.' },
      { id: 'reti', name: 'Réti-Eröffnung', side: 'w', moves: 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O', idea: 'Erst die Figuren, dann die Bauern: Weiß kontrolliert das Zentrum aus der Ferne und bleibt flexibel.' },
    ],
  },
];
