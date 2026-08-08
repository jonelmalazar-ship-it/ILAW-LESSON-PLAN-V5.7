export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: {
        message:
          "GEMINI_API_KEY is not configured in Vercel. Add it under Project Settings → Environment Variables."
      }
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: {
        message: "Method not allowed. Use POST."
      }
    });
  }

  try {
    const body = req.body || {};

    // Test API request
    if (body.test === true) {
      const modelsResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models?key=" +
          encodeURIComponent(apiKey)
      );

      const modelsData = await modelsResponse.json();

      if (!modelsResponse.ok) {
        return res.status(modelsResponse.status).json({
          error: {
            message:
              modelsData?.error?.message ||
              "Gemini API rejected the API key."
          }
        });
      }

      const availableModels = (modelsData.models || [])
        .filter((m) =>
          (m.supportedGenerationMethods || []).includes("generateContent")
        )
        .map((m) => m.name.replace(/^models\//, ""));

      if (!availableModels.length) {
        return res.status(503).json({
          error: {
            message:
              "No Gemini model supporting generateContent is available for this API key."
          }
        });
      }

      return res.status(200).json({
        ok: true,
        model: availableModels[0]
      });
    }

    // The new frontend sends "prompt", not "contents".
    const {
      prompt,
      useSchema = true,
      responseSchema = null
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: {
          message: "Missing prompt."
        }
      });
    }

    // Get models available to this API key.
    const modelsResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?key=" +
        encodeURIComponent(apiKey)
    );

    const modelsData = await modelsResponse.json();

    if (!modelsResponse.ok) {
      return res.status(modelsResponse.status).json({
        error: {
          message:
            modelsData?.error?.message ||
            "Unable to retrieve Gemini models."
        }
      });
    }

    const preferredModels = [
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ];

    const availableModels = (modelsData.models || [])
      .filter((m) =>
        (m.supportedGenerationMethods || []).includes("generateContent")
      )
      .map((m) => m.name.replace(/^models\//, ""));

    if (!availableModels.length) {
      return res.status(503).json({
        error: {
          message:
            "No Gemini model supporting generateContent is available for this API key."
        }
      });
    }

    // Put preferred models first.
    availableModels.sort((a, b) => {
      const ai = preferredModels.indexOf(a);
      const bi = preferredModels.indexOf(b);

      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }

      const aFlash = /flash/i.test(a);
      const bFlash = /flash/i.test(b);

      if (aFlash !== bFlash) {
        return aFlash ? -1 : 1;
      }

      return a.localeCompare(b);
    });

    const errors = [];

    for (const model of availableModels) {
      const generationConfig = {};

      if (
        useSchema &&
        responseSchema &&
        typeof responseSchema === "object"
      ) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = responseSchema;
      }

      const geminiRequest = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig
      };

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(model) +
          ":generateContent?key=" +
          encodeURIComponent(apiKey),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(geminiRequest)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        errors.push(
          model +
            ": " +
            (data?.error?.message ||
              "Gemini returned HTTP " + response.status)
        );
        continue;
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";

      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      if (!cleaned) {
        errors.push(model + ": Gemini returned an empty response.");
        continue;
      }

      try {
        const parsed = JSON.parse(cleaned);

        return res.status(200).json({
          model,
          data: parsed
        });
      } catch (parseError) {
        errors.push(
          model + ": Gemini returned invalid JSON."
        );
      }
    }

    return res.status(502).json({
      error: {
        message:
          "Gemini generation failed on all available models.\n\n" +
          errors.join("\n")
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        message:
          error?.message ||
          "Unexpected server error while contacting Gemini."
      }
    });
  }
}
