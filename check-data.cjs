const mongoose = require("mongoose");
require("dotenv").config();
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const T = require("./backend/models/TechnicalQuestion.js").default;
  const C = require("./backend/models/CodingQuestion.js").default;
  const Co = require("./backend/models/Company.js").default;
  const comps = await Co.find({ status: "active", isDeleted: false }).lean();
  console.log("Companies:", comps.map((c) => c.id + ":" + c.name).join(", "));
  const tech = await T.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: "$companyId", n: { $sum: 1 } } }]);
  console.log("TechnicalQuestions by company:", JSON.stringify(tech));
  const cod = await C.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $group: { _id: "$companyId", n: { $sum: 1 } } }]);
  console.log("CodingQuestions by company:", JSON.stringify(cod));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
