import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Mail, HelpCircle, AlertCircle, ChevronDown, Send } from "lucide-react";
import InputField from "../../components/ui/InputField";
import Button from "../../components/ui/Button";

const FAQ = [
  { q: "Who can use this platform?", a: "Only Sanjivani College of Engineering students with a registered account." },
  { q: "How many interview attempts do I get?", a: "Each student gets 1 official mock interview attempt per cycle." },
  { q: "Can I practice without starting an interview?", a: "Yes. Use Interview Practice for company-specific questions anytime." },
  { q: "How do I update my resume?", a: "Go to Profile → Resume section and upload or replace your PDF resume." },
];

const SUPPORT_EMAIL = "support@sanjivani.edu.in";

function Contact() {
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Message sent! We'll respond within 24 hours.");
      setForm({ name: "", email: "", subject: "", message: "" });
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

        {/* ── Header ── */}
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Help & <span style={{ color: "#EF6905" }}>Support</span>
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Only for Sanjivani College Students
          </p>
        </div>

        {/* ── Support Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-5 rounded-2xl border transition-all duration-300 hover:border-[#EF6905]/25"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(239, 105, 5, 0.08)" }}
            >
              <Mail className="w-4.5 h-4.5" style={{ color: "#EF6905" }} />
            </div>
            <h3
              className="font-semibold text-sm mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Email Support
            </h3>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-sm hover:underline"
              style={{ color: "#EF6905" }}
            >
              {SUPPORT_EMAIL}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl border transition-all duration-300 hover:border-[#EF6905]/25"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(255, 152, 0, 0.08)" }}
            >
              <AlertCircle className="w-4.5 h-4.5" style={{ color: "#FF9800" }} />
            </div>
            <h3
              className="font-semibold text-sm mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Report a Problem
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Use the contact form below to report bugs or issues.
            </p>
          </motion.div>
        </div>

        {/* ── FAQ + Contact Form ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* FAQ */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5" style={{ color: "#EF6905" }} />
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-2">
              {FAQ.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className="rounded-xl border overflow-hidden transition-all duration-300"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: isOpen ? "#EF6905" : "var(--border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                    >
                      <span
                        className="text-sm font-medium pr-4"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.q}
                      </span>
                      <ChevronDown
                        className="w-4 h-4 shrink-0 transition-transform duration-300"
                        style={{
                          color: isOpen ? "#EF6905" : "var(--text-muted)",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                        >
                          <div
                            className="px-4 pb-4 text-sm leading-relaxed"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {item.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* Contact Form */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl border"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h2
              className="text-lg font-semibold mb-5"
              style={{ color: "var(--text-primary)" }}
            >
              Send a Message
            </h2>
            <form onSubmit={handleSubmit}>
              <InputField
                label="Name"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <InputField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <InputField
                label="Subject"
                name="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
              <div className="mb-4">
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Message
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  required
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none transition-all duration-200 focus:ring-2"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#EF6905";
                    e.target.style.boxShadow = "0 0 0 3px rgba(239, 105, 5, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              <Button type="submit" loading={loading}>
                <Send className="w-4 h-4" />
                Send Message
              </Button>
            </form>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

export default Contact;
