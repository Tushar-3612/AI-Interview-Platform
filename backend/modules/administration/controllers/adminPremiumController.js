import User from "../../auth/models/User.js";
import { normalizeDepartment } from "../../student/utils/academicConfig.js";

/**
 * 1. Get List of Premium Users (System Admin Only)
 * GET /api/admin/premium/users
 */
export const getPremiumUsers = async (req, res) => {
  try {
    const { search, department, page = 1, limit = 20 } = req.query;

    const query = { isPremium: true };

    if (department) {
      query.department = normalizeDepartment(department);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { department: { $regex: term, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const students = await User.find(query)
      .select("name email department year isPremium premiumGrantedAt premiumGrantedBy atsScore phone createdAt")
      .populate("premiumGrantedBy", "name email role")
      .sort({ premiumGrantedAt: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      users: students,
      students,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get Premium Users Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch premium users." });
  }
};

/**
 * 2. Grant Premium Membership to a Student (System Admin Only)
 * POST /api/admin/premium/grant
 */
export const grantPremium = async (req, res) => {
  try {
    const targetId = req.body.userId || req.body.studentId || req.body.id;
    const targetEmail = req.body.email;

    let student = null;
    if (targetId) {
      student = await User.findById(targetId);
    } else if (targetEmail && targetEmail.trim()) {
      student = await User.findOne({ email: targetEmail.toLowerCase().trim() });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (student.isPremium) {
      return res.status(400).json({ success: false, message: "This student already has Premium status." });
    }

    student.isPremium = true;
    student.premiumGrantedAt = new Date();
    student.premiumGrantedBy = req.user.id || req.user._id || null;
    await student.save();

    const formatted = {
      _id: student._id,
      id: student._id,
      name: student.name,
      email: student.email,
      department: student.department,
      year: student.year,
      isPremium: true,
      premiumGrantedAt: student.premiumGrantedAt,
    };

    res.json({
      success: true,
      message: `Premium granted successfully to ${student.name}.`,
      student: formatted,
      user: formatted,
    });
  } catch (error) {
    console.error("Grant Premium Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to grant premium status." });
  }
};

/**
 * 3. Revoke Premium Membership from a Student (System Admin Only)
 * POST /api/admin/premium/revoke
 */
export const revokePremium = async (req, res) => {
  try {
    const targetId =
      req.params.studentId ||
      req.params.id ||
      req.body.studentId ||
      req.body.userId ||
      req.body.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "Student ID is required." });
    }

    const student = await User.findById(targetId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    student.isPremium = false;
    student.premiumGrantedAt = null;
    student.premiumGrantedBy = null;
    await student.save();

    const formatted = {
      _id: student._id,
      id: student._id,
      name: student.name,
      email: student.email,
      isPremium: false,
    };

    res.json({
      success: true,
      message: `Premium status removed from ${student.name}.`,
      student: formatted,
      user: formatted,
    });
  } catch (error) {
    console.error("Revoke Premium Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to revoke premium status." });
  }
};

/**
 * 4. Search All Registered Students for Grant Premium modal (System Admin Only)
 * GET /api/admin/premium/search
 */
export const searchStudentsForPremium = async (req, res) => {
  try {
    const searchQuery = req.query.query || req.query.q || req.query.search;
    if (!searchQuery || !searchQuery.trim()) {
      return res.json({ success: true, students: [], users: [] });
    }

    const term = searchQuery.trim();
    // Search across name, email, department, phone in the users collection
    const students = await User.find({
      $or: [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { department: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
      ],
    })
      .select("name email department year isPremium premiumGrantedAt phone createdAt")
      .sort({ name: 1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      students,
      users: students,
    });
  } catch (error) {
    console.error("Search Students for Premium Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to search students." });
  }
};

/**
 * 5. Premium Summary Stats (System Admin Only)
 * GET /api/admin/premium/stats
 */
export const getPremiumStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments();
    const totalPremium = await User.countDocuments({ isPremium: true });

    const byDepartment = await User.aggregate([
      { $match: { isPremium: true } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      totalStudents,
      totalPremium,
      premiumPercentage: totalStudents > 0 ? Math.round((totalPremium / totalStudents) * 100) : 0,
      byDepartment: byDepartment.map((d) => ({
        department: d._id || "Unassigned",
        count: d.count,
      })),
    });
  } catch (error) {
    console.error("Get Premium Stats Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch premium statistics." });
  }
};
