import SystemConfig, { DEFAULT_CONFIGS } from "../models/SystemConfig.js";

export const getConfigs = async (req, res) => {
  try {
    const configs = await SystemConfig.find().lean();
    const merged = DEFAULT_CONFIGS.map(def => {
      const existing = configs.find(c => c.key === def.key);
      return existing || def;
    });
    res.json(merged);
  } catch (error) {
    console.error("Get Configs Error:", error.message);
    res.status(500).json({ message: "Failed to fetch configs" });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: "Key is required" });
    const config = await SystemConfig.findOneAndUpdate(
      { key },
      { $set: { value } },
      { upsert: true, new: true }
    );
    res.json(config);
  } catch (error) {
    console.error("Update Config Error:", error.message);
    res.status(500).json({ message: "Failed to update config" });
  }
};

export const initializeConfigs = async () => {
  try {
    for (const def of DEFAULT_CONFIGS) {
      await SystemConfig.findOneAndUpdate(
        { key: def.key },
        { $setOnInsert: def },
        { upsert: true }
      );
    }
    console.log("System configs initialized");
  } catch (error) {
    console.error("Config initialization error:", error.message);
  }
};
