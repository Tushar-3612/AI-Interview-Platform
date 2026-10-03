import Admin from "../models/Admin.js";
import User from "../../auth/models/User.js";
import { normalizeDepartment, DEPARTMENTS } from "../../student/utils/academicConfig.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

/**
 * 1. Create Teacher / Department Admin Account (System Admin Only)
 */
export const createTeacher = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({ message: "Name, email, password, and department are required." });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    const normDept = normalizeDepartment(department);
    if (!DEPARTMENTS.includes(normDept)) {
      return res.status(400).json({ message: `Invalid department. Must be one of: ${DEPARTMENTS.join(", ")}` });
    }

    // Check duplicate email in Admin collection
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({ message: "An admin or teacher with this email already exists." });
    }

    // Also check duplicate in User collection
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "A student account with this email already exists." });
    }

    const teacher = await Admin.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: "teacher",
      department: normDept,
      isActive: true,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Teacher account created successfully.",
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        department: teacher.department,
        isActive: teacher.isActive,
        createdAt: teacher.createdAt,
      },
    });
  } catch (error) {
    console.error("Create Teacher Error:", error.message);
    res.status(500).json({ message: "Failed to create teacher account." });
  }
};

/**
 * 2. Get All Teachers (System Admin Only)
 */
export const getTeachers = async (req, res) => {
  try {
    const { search, department, status, page = 1, limit = 20 } = req.query;

    const query = { role: "teacher" };

    if (department) {
      query.department = normalizeDepartment(department);
    }

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Admin.countDocuments(query);
    const teachers = await Admin.find(query)
      .select("-password")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({
      teachers,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get Teachers Error:", error.message);
    res.status(500).json({ message: "Failed to fetch teachers." });
  }
};

/**
 * 3. Update Teacher (System Admin Only)
 */
export const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, isActive } = req.body;

    const teacher = await Admin.findById(id);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher account not found." });
    }

    if (name) teacher.name = name.trim();
    if (department) {
      const normDept = normalizeDepartment(department);
      if (!DEPARTMENTS.includes(normDept)) {
        return res.status(400).json({ message: `Invalid department. Must be one of: ${DEPARTMENTS.join(", ")}` });
      }
      teacher.department = normDept;
    }
    if (typeof isActive === "boolean") {
      teacher.isActive = isActive;
    }

    await teacher.save();

    res.json({
      message: "Teacher account updated successfully.",
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        department: teacher.department,
        isActive: teacher.isActive,
        updatedAt: teacher.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update Teacher Error:", error.message);
    res.status(500).json({ message: "Failed to update teacher account." });
  }
};

/**
 * 4. Toggle Teacher Active Status (System Admin Only)
 */
export const toggleTeacherStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await Admin.findById(id);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher account not found." });
    }

    teacher.isActive = !teacher.isActive;
    await teacher.save();

    res.json({
      message: `Teacher account ${teacher.isActive ? "activated" : "deactivated"} successfully.`,
      isActive: teacher.isActive,
    });
  } catch (error) {
    console.error("Toggle Teacher Status Error:", error.message);
    res.status(500).json({ message: "Failed to toggle teacher status." });
  }
};

/**
 * 5. Reset Teacher Password (System Admin Only)
 */
export const resetTeacherPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || !PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: "New password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    const teacher = await Admin.findById(id);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher account not found." });
    }

    teacher.password = newPassword;
    await teacher.save();

    res.json({ message: "Teacher password reset successfully." });
  } catch (error) {
    console.error("Reset Teacher Password Error:", error.message);
    res.status(500).json({ message: "Failed to reset teacher password." });
  }
};

/**
 * 6. Delete Teacher Account (System Admin Only)
 */
export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await Admin.findById(id);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher account not found." });
    }

    await Admin.findByIdAndDelete(id);
    res.json({ message: "Teacher account deleted successfully." });
  } catch (error) {
    console.error("Delete Teacher Error:", error.message);
    res.status(500).json({ message: "Failed to delete teacher account." });
  }
};
