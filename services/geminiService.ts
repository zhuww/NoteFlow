
import { GoogleGenAI, Type } from "@google/genai";
import { SheetAnalysisResult } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert musicologist and optical music recognition (OMR) AI.
Your task is to analyze multiple images representing consecutive pages of a music score and extract playback data.

### TASK:
1.  **Analyze Sequence**: You will receive multiple images. Treat them as Page 1, Page 2, etc.
2.  **Identify Tempo**: Estimate the BPM.
3.  **Extract Frames (Vertical Time Slices)**:
    -   **CORE CONCEPT**: A "Frame" is a SINGLE instant in time where a musical event begins.
    -   **Simultaneity (Polyphony)**:
        -   Include ALL notes that start at this EXACT timestamp.
        -   **Merge Staves**: If the Left Hand (Bass) and Right Hand (Treble) play a note at the same time, they belong to the **SAME** frame. List all pitches in \`notes\`.
        -   **Chords**: All notes in a vertical chord stack belong to the **SAME** frame.
    -   **Sequence (Rhythm)**:
        -   **DO NOT** merge consecutive notes. If note B follows note A (even by a 1/32th note), Note B MUST be in a NEW, separate frame.
        -   One Frame = One Vertical Alignment.
    -   **Duration**: The musical time (in beats) until the *next* frame begins.
    -   **Visual Context (box_2d)**:
        -   **Vertical**: Full Grand Staff height.
        -   **Horizontal**: **WIDE CROP**. Capture approximately **2 full measures** (or ~2-3 seconds of reading ahead).
        -   The active notes should be positioned roughly in the **center or left-center** of the crop, allowing the user to see the upcoming notes.
    -   **Highlighting (note_coordinates)**:
        -   Provide bounding boxes for **ONLY** the specific note heads active in THIS frame (the vertical slice).
        -   Do not highlight future notes yet.
4.  **Page Indexing**: Indicate which page image each frame belongs to.

### OUTPUT FORMAT:
Return pure JSON matching the schema.
`;

export const analyzeSheetMusic = async (images: string[], mimeTypes: string[]): Promise<SheetAnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const imageParts = images.map((base64, index) => ({
      inlineData: {
        data: base64,
        mimeType: mimeTypes[index],
      },
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          ...imageParts,
          {
            text: "Analyze these sheet music pages. Extract tempo, frames, wide context crops (2 measures), and specific note coordinates for highlighting. Ensure simultaneous notes are merged, but consecutive notes are separated.",
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tempo: {
              type: Type.NUMBER,
              description: "The tempo in Beats Per Minute (BPM).",
            },
            frames: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageIndex: {
                    type: Type.NUMBER,
                    description: "The index of the image (0, 1...)",
                  },
                  notes: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "List of pitches (e.g., 'C4', 'E4') or 'rest'.",
                  },
                  duration: {
                    type: Type.NUMBER,
                    description: "Duration until next frame in beats.",
                  },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: "Wide Context Crop [ymin, xmin, ymax, xmax] (0-1000). Approx 2 measures wide.",
                  },
                  note_coordinates: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER }
                    },
                    description: "List of boxes [ymin, xmin, ymax, xmax] for individual note heads active in this frame.",
                  },
                },
                required: ["pageIndex", "notes", "duration", "box_2d", "note_coordinates"],
              },
            },
          },
          required: ["tempo", "frames"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as SheetAnalysisResult;
    
    data.frames = data.frames.map((frame, index) => ({
      ...frame,
      id: `frame-${index}-${Date.now()}`
    }));

    return data;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
