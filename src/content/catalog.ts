import { PieceCatalog } from "../domain/PieceCatalog";
import type { Piece } from "../domain/types";
import { twinkleTwinklePiece } from "./pieces/twinkleTwinkle";
import { maryHadALittleLambPiece } from "./pieces/maryHadALittleLamb";
import { odeToJoyPiece } from "./pieces/odeToJoy";
import { moonlightSonataPiece } from "./pieces/moonlightSonata";
import { rachmaninoffPreludeOp3No2Piece } from "./pieces/rachmaninoffPreludeOp3No2";
import { lisztLaCampanellaPiece } from "./pieces/lisztLaCampanella";
import { lisztHungarianRhapsodyNo2Piece } from "./pieces/lisztHungarianRhapsodyNo2";
import { beethovenPathetiqueMov1Piece } from "./pieces/beethovenPathetiqueMov1";
import { beethovenMoonlightSonataMov3Piece } from "./pieces/beethovenMoonlightSonataMov3";
import { chopinFantaisieImpromptuPiece } from "./pieces/chopinFantaisieImpromptu";
import { chopinHeroicPolonaisePiece } from "./pieces/chopinHeroicPolonaise";
import { chopinBalladeNo1Piece } from "./pieces/chopinBalladeNo1";
import { chopinNocturneOp9No2Piece } from "./pieces/chopinNocturneOp9No2";
import { chopinMinuteWaltzPiece } from "./pieces/chopinMinuteWaltz";
import { debussyClairDeLunePiece } from "./pieces/debussyClairDeLune";

/** Browsable menu of every shipped piece, grouped by composer pack. */
export const contentCatalog = new PieceCatalog([
  {
    composer: "traditional",
    composerDisplay: "Traditional",
    packDisplay: "Folk & Nursery Tunes",
    pieces: [
      {
        dataName: twinkleTwinklePiece.dataName,
        displayName: twinkleTwinklePiece.displayName,
        colorTheme: twinkleTwinklePiece.colorTheme,
      },
      {
        dataName: maryHadALittleLambPiece.dataName,
        displayName: maryHadALittleLambPiece.displayName,
        colorTheme: maryHadALittleLambPiece.colorTheme,
      },
    ],
  },
  {
    composer: "beethoven",
    composerDisplay: "Ludwig van Beethoven",
    packDisplay: "Piano Favorites",
    pieces: [
      {
        dataName: odeToJoyPiece.dataName,
        displayName: odeToJoyPiece.displayName,
        colorTheme: odeToJoyPiece.colorTheme,
      },
      {
        dataName: moonlightSonataPiece.dataName,
        displayName: moonlightSonataPiece.displayName,
        colorTheme: moonlightSonataPiece.colorTheme,
      },
      {
        dataName: beethovenPathetiqueMov1Piece.dataName,
        displayName: beethovenPathetiqueMov1Piece.displayName,
        colorTheme: beethovenPathetiqueMov1Piece.colorTheme,
      },
      {
        dataName: beethovenMoonlightSonataMov3Piece.dataName,
        displayName: beethovenMoonlightSonataMov3Piece.displayName,
        colorTheme: beethovenMoonlightSonataMov3Piece.colorTheme,
      },
    ],
  },
  {
    composer: "rachmaninoff",
    composerDisplay: "Sergei Rachmaninoff",
    packDisplay: "Romantic Showpieces",
    pieces: [
      {
        dataName: rachmaninoffPreludeOp3No2Piece.dataName,
        displayName: rachmaninoffPreludeOp3No2Piece.displayName,
        colorTheme: rachmaninoffPreludeOp3No2Piece.colorTheme,
      },
    ],
  },
  {
    composer: "chopin",
    composerDisplay: "Frédéric Chopin",
    packDisplay: "Romantic Favorites",
    pieces: [
      {
        dataName: chopinFantaisieImpromptuPiece.dataName,
        displayName: chopinFantaisieImpromptuPiece.displayName,
        colorTheme: chopinFantaisieImpromptuPiece.colorTheme,
      },
      {
        dataName: chopinHeroicPolonaisePiece.dataName,
        displayName: chopinHeroicPolonaisePiece.displayName,
        colorTheme: chopinHeroicPolonaisePiece.colorTheme,
      },
      {
        dataName: chopinBalladeNo1Piece.dataName,
        displayName: chopinBalladeNo1Piece.displayName,
        colorTheme: chopinBalladeNo1Piece.colorTheme,
      },
      {
        dataName: chopinNocturneOp9No2Piece.dataName,
        displayName: chopinNocturneOp9No2Piece.displayName,
        colorTheme: chopinNocturneOp9No2Piece.colorTheme,
      },
      {
        dataName: chopinMinuteWaltzPiece.dataName,
        displayName: chopinMinuteWaltzPiece.displayName,
        colorTheme: chopinMinuteWaltzPiece.colorTheme,
      },
    ],
  },
  {
    composer: "debussy",
    composerDisplay: "Claude Debussy",
    packDisplay: "Impressionist Favorites",
    pieces: [
      {
        dataName: debussyClairDeLunePiece.dataName,
        displayName: debussyClairDeLunePiece.displayName,
        colorTheme: debussyClairDeLunePiece.colorTheme,
      },
    ],
  },
  {
    composer: "liszt",
    composerDisplay: "Franz Liszt",
    packDisplay: "Virtuoso Etudes",
    pieces: [
      {
        dataName: lisztLaCampanellaPiece.dataName,
        displayName: lisztLaCampanellaPiece.displayName,
        colorTheme: lisztLaCampanellaPiece.colorTheme,
      },
      {
        dataName: lisztHungarianRhapsodyNo2Piece.dataName,
        displayName: lisztHungarianRhapsodyNo2Piece.displayName,
        colorTheme: lisztHungarianRhapsodyNo2Piece.colorTheme,
      },
    ],
  },
]);

/** Full `Piece` data for every piece the catalog references, keyed by dataName — the composition root loads chord data from here (a real app would fetch these lazily; for now everything is bundled). */
export const contentPieces: ReadonlyMap<string, Piece> = new Map([
  [twinkleTwinklePiece.dataName, twinkleTwinklePiece],
  [maryHadALittleLambPiece.dataName, maryHadALittleLambPiece],
  [odeToJoyPiece.dataName, odeToJoyPiece],
  [moonlightSonataPiece.dataName, moonlightSonataPiece],
  [rachmaninoffPreludeOp3No2Piece.dataName, rachmaninoffPreludeOp3No2Piece],
  [lisztLaCampanellaPiece.dataName, lisztLaCampanellaPiece],
  [lisztHungarianRhapsodyNo2Piece.dataName, lisztHungarianRhapsodyNo2Piece],
  [beethovenPathetiqueMov1Piece.dataName, beethovenPathetiqueMov1Piece],
  [
    beethovenMoonlightSonataMov3Piece.dataName,
    beethovenMoonlightSonataMov3Piece,
  ],
  [chopinFantaisieImpromptuPiece.dataName, chopinFantaisieImpromptuPiece],
  [chopinHeroicPolonaisePiece.dataName, chopinHeroicPolonaisePiece],
  [chopinBalladeNo1Piece.dataName, chopinBalladeNo1Piece],
  [chopinNocturneOp9No2Piece.dataName, chopinNocturneOp9No2Piece],
  [chopinMinuteWaltzPiece.dataName, chopinMinuteWaltzPiece],
  [debussyClairDeLunePiece.dataName, debussyClairDeLunePiece],
]);
