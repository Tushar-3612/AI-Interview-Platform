import { useState } from "react";
import { motion } from "framer-motion";
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

/**
 * Contact Page — help & support for Sanjivani students.
 */
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Help & Support
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Only for Sanjivani College Students
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="student-card p-5">
            <Mail className="w-5 h-5 mb-3" style={{ color: "var(--primary)" }} />
            <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>24×7 Email Support</h3>
            <a href="mailto:support@sanjivani.edu.in" className="text-sm hover:underline" style={{ color: "var(--primary)" }}>
              artinterviewplatform@hire.com
            </a>
          </div>
          <div className="student-card p-5">
            <AlertCircle className="w-5 h-5 mb-3" style={{ color: "var(--error)" }} />
            <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>Report a Problem</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Use the contact form below to report bugs or issues.</p>
          </div>
        </div>

        {/* FAQ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>FAQ</h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="student-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                >
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === i ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm" style={{ color: "var(--text-secondary)" }}>{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section className="student-card p-6">
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Contact Form</h2>
          <form onSubmit={handleSubmit}>
            <InputField label="Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <InputField label="Email" name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <InputField label="Subject" name="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>Message</label>
              <textarea
                name="message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4}
                required
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
              />
            </div>
            <Button type="submit" loading={loading}>
              <Send className="w-4 h-4" />
              Send Message
            </Button>
          </form>
        </section>
      </motion.div>
    </div>
  );
}

export default Contact;
