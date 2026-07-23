import React from "react";

function CodeEditorArea({ code, onChange }) {
  return (
    <div className="h-64 mt-4 rounded-xl overflow-hidden border border-slate-300 dark:border-zinc-700">
      <div className="bg-slate-800 text-slate-200 px-4 py-2 text-xs font-mono flex justify-between items-center">
        <span>Code Editor</span>
        <span>JavaScript</span>
      </div>
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full p-4 bg-slate-900 text-slate-100 font-mono text-sm focus:outline-none resize-none"
        placeholder="// Write your code here..."
        spellCheck={false}
      />
    </div>
  );
}

export default CodeEditorArea;
