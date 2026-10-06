import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Mail, HelpCircle, AlertCircle, ChevronDown, Send } from "lucide-react";
import InputField from "../../../core/ui/InputField.jsx";
import Button from "../../../core/ui/Button.jsx";

const FAQ = [
  { q: "Who can use this platform?", a: "Only Sanjivani College of Engineering students with a registered account." },
  { q: "How many interview attempts do I get?", a: "Each student gets 1 official mock interview attempt per cycle." },
  { q: "Can I practice without starting an interview?", a: "Yes. Use Interview Practice for company-specific questions anytime." },
  { q: "How do I update my resume?", a: "Go to Profile → Resume section and upload or replace your PDF resume." },
];

const SUPPORT_EMAILS = [
  "tusharnagare2006@gmail.com",
  "roshanlanghi28@gmail.com",
  "amollende02@gmail.com",
];

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
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

        {/* ── PAGE HERO CONTAINER ── */}
        <section className="page-hero space-y-4">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-[#FF6B35]/10 border-[#FF6B35]/30 text-[#FF6B35]">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="page-title-row flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-primary)]">
                    Help & Support
                  </h1>
                  <span className="program-badge">
                    Student Help Desk
                  </span>
                </div>
                <p className="page-description text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
                  Have questions about test rounds, interview attempts, or technical issues? Reach out to our placement support team.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-bold px-3.5 py-1.5 rounded-xl border border-[#FF6B35]/35 bg-[#FF6B35]/10 text-[#FF6B35]">
                Sanjivani College of Engineering
              </span>
            </div>
          </div>
        </section>

        {/* ── Support Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-5 rounded-2xl border transition-all duration-300 hover:border-[#FF6B35]/30"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 border border-[#FF6B35]/25"
              style={{ background: "rgba(255, 107, 53, 0.10)" }}
            >
              <Mail className="w-4.5 h-4.5" style={{ color: "#FF6B35" }} />
            </div>
            <h3
              className="font-semibold text-sm mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Email Support
            </h3>
            <div className="flex flex-col gap-1.5">
              {SUPPORT_EMAILS.map((email) => (
                <a
                  key={email}
                  href={`mailto:${email}`}
                  className="text-sm hover:underline break-all"
                  style={{ color: "#EF6905" }}
                >
                  {email}
                </a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl border transition-all duration-300 hover:border-[#FF6B35]/30"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 border border-[#FF6B35]/25"
              style={{ background: "rgba(255, 107, 53, 0.10)" }}
            >
              <AlertCircle className="w-4.5 h-4.5" style={{ color: "#FF6B35" }} />
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
              <HelpCircle className="w-5 h-5" style={{ color: "#FF6B35" }} />
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
                      borderColor: isOpen ? "#FF6B35" : "var(--border)",
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
                          color: isOpen ? "#FF6B35" : "var(--text-muted)",
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
                    e.target.style.borderColor = "#FF6B35";
                    e.target.style.boxShadow = "0 0 0 3px rgba(255, 107, 53, 0.15)";
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
