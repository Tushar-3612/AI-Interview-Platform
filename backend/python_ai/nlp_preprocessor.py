"""
nlp_preprocessor.py
====================
NLP answer preprocessing for Real Interview evaluation.

Input (stdin): JSON { "answer": "...", "round": "technical|project|hr", "maxWords": 300 }
Output (stdout): JSON { "success": true, "originalAnswer": "...", "normalizedAnswer": "...",
                        "compactAnswer": "...", "tokenCountBefore": N, "tokenCountAfter": M, "reductionPercent": P }

Uses ONLY Python stdlib (re, json, sys, string). No external packages needed.
"""

import sys
import json
import re

# --- Negations (must NEVER be removed)
NEGATIONS = {
    "not","no","never","none","nobody","nothing","neither","nor","without",
    "cannot","can't","won't","don't","doesn't","isn't","aren't","wasn't",
    "weren't","hadn't","hasn't","haven't","wouldn't","couldn't","shouldn't",
    "didn't","mustn't"
}

# --- Cause/effect connectors (preserve reasoning)
CAUSE_EFFECT = {
    "because","therefore","thus","hence","since","due","consequently","ensures",
    "prevents","allows","enables","requires","depends","result","reason","leads"
}

# --- HR behavioral signals
HR_KEYWORDS = {
    "situation","task","action","result","decided","handled","managed","resolved",
    "communicated","collaborated","led","ownership","accountable","responsible",
    "conflict","challenge","learned","improved","escalated","prioritized",
    "feedback","deadline","pressure","mistake","failure","success","achieved","delivered"
}

# Patterns for tech/reasoning content worth keeping
_TECH_RE = re.compile(
    r'\b(api|rest|graphql|http|jwt|oauth|sql|nosql|mongodb|postgresql|mysql|redis|'
    r'kafka|docker|kubernetes|aws|azure|gcp|git|nginx|flask|django|fastapi|express|'
    r'react|angular|vue|node\.?js|typescript|javascript|python|java|golang|'
    r'microservice|serverless|cache|queue|async|await|promise|middleware|router|'
    r'controller|model|schema|index|query|transaction|acid|cap|websocket|ssl|tls|'
    r'encryption|hash|bcrypt|token|session|cookie|cors|csrf|xss|injection|auth|'
    r'rbac|rate.?limit|load.?balance|scalab|availab|latency|throughput|memory|cpu|'
    r'thread|process|concurren|parallel|mutex|deadlock|race.?condition|algorithm|'
    r'complex|binary|sort|search|tree|graph|stack|array|linked.?list|dynamic.?program|'
    r'recursi|iteration|debug|unit.?test|integration|ci.?cd|devops|agile|deploy|'
    r'rollback|monitor|log|trace|metric|alert|implement|design|architect|optimiz|'
    r'refactor|build|creat|develop|solv|fix|improv|reduc|increas|scale|migrat|'
    r'not|no|never|without|cannot|prevent|avoid|instead|rather|unless|except)\b',
    re.IGNORECASE
)
_NUMBER_RE = re.compile(r'\b\d+(?:\.\d+)?(?:%|ms|s|mb|gb|kb|k|m|x)?\b', re.IGNORECASE)

def _word_count(text):
    return len(text.split()) if text else 0

def _normalize_ws(text):
    text = re.sub(r'\r\n|\r', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def _split_sentences(text):
    parts = re.split(r'(?<=[.!?])\s+', text)
    result = []
    for part in parts:
        for line in part.split('\n'):
            line = line.strip()
            if line and len(line.split()) >= 3:
                result.append(line)
    return result

def _dedup_sentences(sentences):
    seen = set()
    out = []
    for s in sentences:
        fp = re.sub(r'[^\w\s]', '', s.lower())
        fp = re.sub(r'\s+', ' ', fp).strip()[:60]
        if fp not in seen:
            seen.add(fp)
            out.append(s)
    return out

def _remove_repeated_phrases(text):
    words = text.split()
    if len(words) < 20:
        return text
    trigrams = {}
    for i in range(len(words) - 2):
        tg = ' '.join(words[i:i+3]).lower()
        trigrams[tg] = trigrams.get(tg, 0) + 1
    repeated = {t for t, c in trigrams.items() if c >= 3}
    if not repeated:
        return text
    result = []
    skip = -1
    for i, word in enumerate(words):
        if i <= skip:
            continue
        tg = ' '.join(words[i:i+3]).lower() if i + 2 < len(words) else ''
        if tg in repeated:
            repeated.discard(tg)
            result.extend(words[i:i+3])
            skip = i + 2
        else:
            result.append(word)
    return ' '.join(result)

def _score_sentence(sent, round_type, all_sents):
    score = 0
    lower = sent.lower()
    wset = set(lower.split())
    if _TECH_RE.search(lower):
        score += 5
    if wset & NEGATIONS:
        score += 4
    if wset & CAUSE_EFFECT:
        score += 3
    if round_type == 'hr' and (wset & HR_KEYWORDS):
        score += 3
    if _NUMBER_RE.search(lower):
        score += 2
    if sent in (all_sents[0], all_sents[-1]):
        score += 2
    return score

def preprocess(answer, round_type='technical', max_words=300):
    if not answer or not answer.strip():
        return '', ''
    normalized = _normalize_ws(answer)
    orig_wc = _word_count(normalized)
    if orig_wc <= 80:
        return normalized, normalized
    deduped = _remove_repeated_phrases(normalized)
    sentences = _split_sentences(deduped)
    sentences = _dedup_sentences(sentences)
    if not sentences:
        return normalized, normalized
    scored = [(  _score_sentence(s, round_type, sentences), i, s) for i, s in enumerate(sentences)]
    scored.sort(key=lambda x: x[0], reverse=True)
    selected_idx = set()
    current_wc = 0
    for score, idx, sent in scored:
        swc = _word_count(sent)
        if current_wc + swc <= max_words:
            selected_idx.add(idx)
            current_wc += swc
        if current_wc >= max_words * 0.85:
            break
    # Re-order by original position
    selected = [s for i, s in enumerate(sentences) if i in selected_idx]
    compact = ' '.join(selected)
    # Safety guard: don't over-compress short answers
    if _word_count(compact) < orig_wc * 0.3 and orig_wc <= 200:
        return normalized, normalized
    return compact if compact else normalized, normalized

def main():
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            print(json.dumps({'success': False, 'error': 'Empty input'}))
            sys.exit(1)
        payload = json.loads(raw)
        answer = payload.get('answer', '')
        round_type = payload.get('round', 'technical').lower()
        max_words = int(payload.get('maxWords', 300))
        if not answer or not answer.strip():
            print(json.dumps({
                'success': True, 'originalAnswer': '',
                'normalizedAnswer': '', 'compactAnswer': '',
                'tokenCountBefore': 0, 'tokenCountAfter': 0, 'reductionPercent': 0
            }))
            sys.exit(0)
        compact, normalized = preprocess(answer, round_type, max_words)
        before = _word_count(answer)
        after = _word_count(compact)
        reduction = round((1 - after / before) * 100, 1) if before > 0 else 0
        print(json.dumps({
            'success': True,
            'originalAnswer': answer,
            'normalizedAnswer': normalized,
            'compactAnswer': compact,
            'tokenCountBefore': before,
            'tokenCountAfter': after,
            'reductionPercent': reduction
        }))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
