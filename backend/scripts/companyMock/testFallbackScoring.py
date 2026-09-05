#!/usr/bin/env python3
"""
Test deterministic fallback scoring for Company Mock Technical answers.
Sentence-level concept extraction with multi-word phrase matching.
"""

import re

STOPWORDS = set("""a an the is are was were be been being have has had do does did
will would shall should may might must can could of in to for with on at from
by about as into through during before after above below between out off over
under again further then once here there when where why how all both each few
more most other some such no nor not only own same so than too very just don now
and but or if while that this these those it its i me my we our you your he him
his she her they them their what which who whom up down also like well much many
get got make made say said go going come came know known think take taken see seen
want use used find found give given tell told work call need try tried ask asked
put keep let begin seem help show hear play run move live believe bring happen
write provide sit stand lose pay meet include continue set learn change lead
understand watch follow stop create speak read allow add spend grow open walk win
offer remember love consider appear buy wait serve die send expect build stay fall
cut reach kill remain suggest raise pass sell require report decide pull develop
agree support hold produce eat apply feel especially actually however typically
often using used based may can will also rather one two three four five first
second third new old different similar important example part number type system
way method technique approach because therefore thus hence since means whereas
while although though despite however moreover furthermore specifically
particularly especially generally typically usually sometimes rarely never always
better worse good bad best worst high low more less increase decrease improve reduce
key common main core important significant fundamental difference between versus
compare comparison define explain describe discuss outline list give state
""".split())

SEMANTIC_EQUIVALENCE = {
    "performance on unseen data": "generalization",
    "does not generalize": "overfitting",
    "learns noise": "overfitting",
    "high variance": "overfitting",
    "high bias": "underfitting",
    "mean absolute error": "mae",
    "mean squared error": "mse",
    "vanishing gradient": "gradient vanishing",
    "long range dependencies": "long-term dependencies",
    "gating mechanism": "gates",
    "memory cell": "cell state",
    "self attention": "attention",
    "multi-head attention": "attention",
    "penalty": "regularization",
    "shrinkage": "regularization",
    "l1 regularization": "l1",
    "l2 regularization": "l2",
    "lasso": "l1",
    "ridge": "l2",
    "impurity": "entropy",
    "disorder": "entropy",
    "bootstrap aggregating": "bagging",
    "sequential training": "boosting",
    "correcting errors": "boosting",
    "meta-learner": "stacking",
    "combining models": "ensemble",
    "majority vote": "voting",
    "resample with replacement": "bootstrapping",
    "bootstrap sample": "bootstrapping",
    "central tendency": "mean",
    "average value": "mean",
    "middle value": "median",
    "most frequent": "mode",
    "spread": "variance",
    "null hypothesis": "h0",
    "alternative hypothesis": "ha",
    "significance level": "alpha",
    "rectified linear": "relu",
    "logistic sigmoid": "sigmoid",
    "hyperbolic tangent": "tanh",
    "squashing function": "sigmoid",
    "bell curve": "normal distribution",
    "gaussian": "normal distribution",
    "number of successes": "binomial",
    "fixed number of trials": "binomial",
    "two outcomes": "binomial",
    "independent trials": "binomial",
    "positional encoding": "transformer",
    "feed forward": "transformer",
    "bias variance": "bias-variance",
}


def normalize(text):
    return re.sub(r'[^a-z0-9\s\-]', ' ', text.lower()).split()

def normalize_text(text):
    return ' '.join(normalize(text))

def extract_words(text):
    return [w for w in normalize(text) if len(w) >= 2 and w not in STOPWORDS]

def extract_key_phrases(text):
    words = [w for w in normalize_text(text).split() if len(w) >= 2]
    phrases = set()
    for w in words:
        if w not in STOPWORDS and len(w) >= 3:
            phrases.add(w)
    for i in range(len(words) - 1):
        w1, w2 = words[i], words[i+1]
        if ((w1 not in STOPWORDS and len(w1) >= 3) or (w2 not in STOPWORDS and len(w2) >= 3)):
            phrases.add(f"{w1} {w2}")
    for i in range(len(words) - 2):
        w1, w2, w3 = words[i], words[i+1], words[i+2]
        if ((w1 not in STOPWORDS and len(w1) >= 3) or (w2 not in STOPWORDS and len(w2) >= 3) or (w3 not in STOPWORDS and len(w3) >= 3)):
            phrases.add(f"{w1} {w2} {w3}")
    return phrases

def are_equivalent(p1, p2):
    n1 = normalize_text(p1)
    n2 = normalize_text(p2)
    if n1 == n2: return True
    c1 = SEMANTIC_EQUIVALENCE.get(n1)
    c2 = SEMANTIC_EQUIVALENCE.get(n2)
    if c1 and c2 and c1 == c2: return True
    if c1 == n2 or c2 == n1: return True
    return False

def phrase_matches(cp, kp):
    if are_equivalent(cp, kp): return True
    ncp = normalize_text(cp)
    nkp = normalize_text(kp)
    if ncp in nkp or nkp in ncp: return True
    return False

def concept_coverage_fraction(candidate_text, concept_phrases):
    if not concept_phrases: return 0
    cand_phrases = extract_key_phrases(candidate_text)
    norm_cand = normalize_text(candidate_text)
    covered = 0
    for kp in concept_phrases:
        found = False
        if kp in cand_phrases: found = True
        elif kp in norm_cand: found = True
        else:
            for cp in cand_phrases:
                if phrase_matches(cp, kp):
                    found = True
                    break
        if found: covered += 1
    return covered / len(concept_phrases)

def extract_concepts(expected, question=""):
    if not expected: return []
    sentences = [s.strip() for s in re.split(r'[.;:]\s+', expected) if len(s.strip()) > 10]
    if not sentences: return []
    question_words = set(extract_words(question or ""))
    concepts = []
    for i, sentence in enumerate(sentences):
        key_phrases = extract_key_phrases(sentence)
        if not key_phrases: continue
        importance = "supporting"
        if i == 0: importance = "core"
        elif i == len(sentences) - 1 and len(sentences) > 2: importance = "optional"
        sent_words = extract_words(sentence)
        overlap = [w for w in sent_words if w in question_words]
        if len(overlap) >= 2: importance = "core"
        concepts.append({'key_phrases': list(key_phrases), 'sentence': sentence, 'importance': importance})
    return concepts

def compute_coverage(candidate_text, concepts):
    ct = cc = st = sc = ot = oc = 0
    total_phrases = sum(len(c['key_phrases']) for c in concepts)
    covered_phrases = 0
    covered = []
    missing = []
    for c in concepts:
        frac = concept_coverage_fraction(candidate_text, c['key_phrases'])
        is_cov = frac >= 0.30
        covered_phrases += round(frac * len(c['key_phrases']))
        if c['importance'] == "core":
            ct += 1
            if is_cov: cc += 1; covered.append(c['sentence'])
            else: missing.append(c['sentence'])
        elif c['importance'] == "supporting":
            st += 1
            if is_cov: sc += 1; covered.append(c['sentence'])
            else: missing.append(c['sentence'])
        else:
            ot += 1
            if is_cov: oc += 1; covered.append(c['sentence'])
    phrase_frac = covered_phrases / total_phrases if total_phrases > 0 else 0
    return {
        'core_total': ct, 'core_covered': cc,
        'supporting_total': st, 'supporting_covered': sc,
        'optional_total': ot, 'optional_covered': oc,
        'total_phrases': total_phrases, 'covered_phrases': covered_phrases,
        'phrase_fraction': phrase_frac,
        'covered': covered, 'missing': missing,
    }

def score_by_coverage(coverage, max_marks, cand_len, exp_len):
    ct = coverage['core_total']
    cc = coverage['core_covered']
    st = coverage['supporting_total']
    sc = coverage['supporting_covered']
    ot = coverage['optional_total']
    oc = coverage['optional_covered']
    pf = coverage['phrase_fraction']
    total = ct + st + ot
    if total == 0: return None
    core_ratio = cc / ct if ct > 0 else 1
    support_ratio = sc / st if st > 0 else 1
    optional_ratio = oc / ot if ot > 0 else 1
    concept_score = core_ratio * 0.60 + support_ratio * 0.30 + optional_ratio * 0.10
    length_ratio = min(cand_len / max(exp_len * 0.2, 15), 1)
    score = (concept_score * 0.7 + pf * 0.3) * max_marks
    if length_ratio < 0.15: score *= 0.6
    elif length_ratio < 0.3: score *= 0.8
    return score

def compute_word_overlap(candidate, expected):
    cand_words = set(extract_words(candidate))
    exp_words = set(extract_words(expected))
    if not exp_words: return 0
    return len(cand_words & exp_words) / len(exp_words)

def score_by_difficulty(ratio, max_marks, cand_len, exp_len):
    length_ratio = min(cand_len / max(exp_len * 0.25, 15), 1)
    if max_marks <= 2:
        if ratio >= 0.60 and length_ratio >= 0.3: return max_marks
        if ratio >= 0.40 and length_ratio >= 0.2: return 1.5
        if ratio >= 0.20: return 1
        if ratio > 0 and length_ratio >= 0.2: return 0.5
        return 0
    if max_marks <= 3:
        if ratio >= 0.75 and length_ratio >= 0.4: return max_marks
        if ratio >= 0.55 and length_ratio >= 0.3: return 2.5
        if ratio >= 0.45: return 2
        if ratio >= 0.30: return 1.5
        if ratio >= 0.18: return 1
        if ratio > 0 and length_ratio >= 0.15: return 0.5
        return 0
    if ratio >= 0.85 and length_ratio >= 0.5: return max_marks
    if ratio >= 0.70 and length_ratio >= 0.4: return max_marks - 1
    if ratio >= 0.55 and length_ratio >= 0.3: return max_marks - 2
    if ratio >= 0.40: return max_marks - 3
    if ratio >= 0.25: return 1.5
    if ratio >= 0.12: return 1
    if ratio > 0 and length_ratio >= 0.15: return 0.5
    return 0

def test_score(candidate, expected, max_marks, question="", label=""):
    concepts = extract_concepts(expected, question)
    print(f"  [{label:30s}] concepts={len(concepts)} ({', '.join(c['importance'] for c in concepts)})")
    if len(concepts) >= 2:
        coverage = compute_coverage(candidate, concepts)
        score = score_by_coverage(coverage, max_marks, len(candidate), len(expected))
        if score is None:
            wo = compute_word_overlap(candidate, expected)
            score = score_by_difficulty(wo, max_marks, len(candidate), len(expected))
        print(f"  {'':30s} phrase_frac={coverage['phrase_fraction']:.2f} core={coverage['core_covered']}/{coverage['core_total']}")
    else:
        wo = compute_word_overlap(candidate, expected)
        score = score_by_difficulty(wo, max_marks, len(candidate), len(expected))
    score = max(0, min(max_marks, score))
    score = round(score * 2) / 2
    print(f"  {'':30s} score={score}/{max_marks}")
    return score


# ══════════════════════════════════════════════════════════════════
print("=" * 70)
print("BASIC TESTS -- Easy (2 marks)")
print("=" * 70)

easy_expected = "Overfitting occurs when a model learns the training data too well, including noise, leading to poor performance on unseen or test data. It means the model has high variance and does not generalize."

s1 = test_score("Overfitting happens when a model performs very well on training data but poorly on new unseen data. The model captures noise and irrelevant patterns instead of the underlying relationship.", easy_expected, 2, "What is overfitting?", "correct")
s2 = test_score("Overfitting is when the model learns too much from training data.", easy_expected, 2, "What is overfitting?", "partial")
s3 = test_score("Overfitting means the model is too simple and cannot capture the pattern.", easy_expected, 2, "What is overfitting?", "wrong")

assert s1 >= 1.5, f"Easy correct should score >= 1.5, got {s1}"
assert s3 <= 1.0, f"Easy wrong should score <= 1.0, got {s3}"
print("  PASS\n")

print("=" * 70)
print("BASIC TESTS -- Medium (3 marks)")
print("=" * 70)

medium_expected = "Precision = TP / (TP + FP), measures how many predicted positives are actually positive. Recall = TP / (TP + FN), measures how many actual positives are correctly identified. They trade off: high precision means few false positives; high recall means few false negatives. F1 = 2 x (Precision x Recall) / (Precision + Recall), the harmonic mean balancing both. Use precision when false positives are costly (spam filter: don't mark legitimate email as spam). Use recall when false negatives are costly (disease detection: don't miss sick patients). F1 is preferred when both errors matter and classes are imbalanced."

s1 = test_score("Precision measures how many predicted positives are actually correct. Recall measures how many actual positives were found. F1 is the harmonic mean balancing both. Use precision when false positives are costly and recall when false negatives are costly.", medium_expected, 3, "Explain precision and recall", "correct")
s2 = test_score("Precision is about accurate positive predictions. Recall is about finding all positives.", medium_expected, 3, "Explain precision and recall", "partial")
s3 = test_score("Precision and recall are both percentages that measure different things about classification models.", medium_expected, 3, "Explain precision and recall", "wrong")

assert s1 >= 2.0, f"Medium correct should score >= 2.0, got {s1}"
assert s3 <= 1.5, f"Medium wrong should score <= 1.5, got {s3}"
print("  PASS\n")

print("=" * 70)
print("BASIC TESTS -- Hard (5 marks)")
print("=" * 70)

hard_expected = "LSTM is preferred over basic RNN for long-term dependencies because LSTMs solve the vanishing gradient problem through gating mechanisms. The forget gate controls what information to discard from the cell state, the input gate controls what new information to store, and the output gate controls what to output. The cell state acts as a memory highway allowing gradients to flow through time without vanishing, enabling the network to learn long-range dependencies that basic RNNs cannot capture. LSTMs maintain a separate cell state that can preserve information across many time steps."

s1 = test_score("LSTMs solve the vanishing gradient problem using gating mechanisms. The cell state acts as a memory highway for long-term dependencies. Gates control information flow: forget gate discards, input gate stores, output gate outputs. This enables learning long-range dependencies that basic RNNs cannot.", hard_expected, 5, "Why is LSTM preferred over basic RNN?", "complete")
s2 = test_score("LSTMs have gates and a cell state that helps remember information over long sequences. RNNs struggle with long sequences because gradients vanish.", hard_expected, 5, "Why is LSTM preferred over basic RNN?", "partial")
s3 = test_score("LSTMs are faster than RNNs because they use parallel processing on GPUs.", hard_expected, 5, "Why is LSTM preferred over basic RNN?", "wrong")

assert s1 >= 3.0, f"Hard complete should score >= 3.0, got {s1}"
assert s3 <= 1.0, f"Hard wrong should score <= 1.0, got {s3}"
print("  PASS\n")


# ══════════════════════════════════════════════════════════════════
# REGRESSION: No cross-question concept leakage
# ══════════════════════════════════════════════════════════════════

print("=" * 70)
print("REGRESSION -- LSTM (no word counts / TF-IDF)")
print("=" * 70)

lstm_expected = "LSTM is preferred over basic RNN for long-term dependencies because LSTMs solve the vanishing gradient problem through gating mechanisms. The forget gate controls what information to discard from the cell state, the input gate controls what new information to store, and the output gate controls what to output. The cell state acts as a memory highway allowing gradients to flow through time without vanishing."

concepts = extract_concepts(lstm_expected, "Why is LSTM preferred over basic RNN?")
all_text = " ".join(c['sentence'].lower() for c in concepts)
assert "word count" not in all_text and "tf-idf" not in all_text, f"Leakage! {all_text}"
s = test_score("LSTMs address vanishing gradients through gating mechanisms and a cell state that preserves information across long sequences. This enables learning long-term dependencies that basic RNNs cannot capture due to gradient decay.", lstm_expected, 5, "Why is LSTM preferred over basic RNN?", "LSTM regression")
assert s >= 2.5, f"LSTM answer should score >= 2.5, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Accuracy misleading")
print("=" * 70)

accuracy_expected = "Accuracy = (TP + TN) / (TP + TN + FP + FN), measures overall correctness. It can be misleading with imbalanced datasets. Example: if 95% of samples are class A, a model predicting all A achieves 95% accuracy but is useless. Alternatives: Precision, Recall, F1, AUC-ROC, Confusion Matrix, Cohen's Kappa, Matthews Correlation Coefficient."

concepts = extract_concepts(accuracy_expected, "When can accuracy be misleading?")
all_text = " ".join(c['sentence'].lower() for c in concepts)
assert "tf-idf" not in all_text and "word count" not in all_text, f"Leakage! {all_text}"
s = test_score("Accuracy is the ratio of correct predictions to total predictions. It can be misleading when classes are imbalanced because a model can achieve high accuracy by simply predicting the majority class. Alternatives include precision, recall, F1 score, and AUC-ROC.", accuracy_expected, 3, "When can accuracy be misleading?", "Accuracy regression")
assert s >= 1.5, f"Accuracy answer should score >= 1.5, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Bootstrapping (no TF-IDF)")
print("=" * 70)

boot_expected = "Bootstrapping is a resampling technique where samples are drawn with replacement from the original dataset to create multiple bootstrap samples. Each sample has the same size as the original. Key applications: (1) Bagging in ensemble methods (Random Forest uses bootstrapped subsets). (2) Confidence interval estimation via bootstrap distributions. (3) Model validation when data is limited. (4) Estimating standard errors and bias. Bootstrapping works because it approximates the population distribution through repeated sampling, enabling statistical inference without strong distributional assumptions."

concepts = extract_concepts(boot_expected, "What is bootstrapping in machine learning?")
all_text = " ".join(c['sentence'].lower() for c in concepts)
assert "tf-idf" not in all_text and "word count" not in all_text, f"Leakage! {all_text}"
s = test_score("Bootstrapping involves resampling data with replacement to create multiple samples of the same size as the original. It is used in bagging for ensemble methods, for estimating confidence intervals, and for validating models when data is limited.", boot_expected, 5, "What is bootstrapping?", "Bootstrapping regression")
assert s >= 2.0, f"Bootstrapping answer should score >= 2.0, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Transformers")
print("=" * 70)

tfm_expected = "The Transformer is a deep learning architecture based entirely on self-attention mechanisms, introduced in the 2017 paper Attention Is All You Need. Unlike RNNs and LSTMs, it processes entire sequences in parallel, capturing long-range dependencies without recurrence. Key components include multi-head self-attention, positional encoding, layer normalization, and feed-forward networks. Transformers are better because parallel computation enables faster training, self-attention captures dependencies regardless of distance, and they scale effectively to large datasets."

concepts = extract_concepts(tfm_expected, "Explain the Transformer model")
s = test_score("The Transformer uses self-attention mechanisms to process sequences in parallel rather than sequentially like RNNs. Multi-head attention captures relationships between all tokens simultaneously. Positional encoding preserves sequence order. This parallel architecture enables faster training and captures long-range dependencies more effectively.", tfm_expected, 5, "Explain the Transformer model", "Transformers regression")
assert s >= 3.0, f"Transformers answer should score >= 3.0, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- L1 vs L2")
print("=" * 70)

l1l2_expected = "L1 (Lasso) adds absolute value of coefficients as penalty term, driving some coefficients to exactly zero (feature selection). L2 (Ridge) adds squared magnitude of coefficients, shrinking all toward zero but rarely to exactly zero. L1 produces sparse models useful for feature selection. L2 produces smoother models and handles multicollinearity better. Elastic Net combines both L1 and L2 penalties."

concepts = extract_concepts(l1l2_expected, "Difference between L1 and L2 regularization")
s = test_score("L1 regularization adds absolute value penalty, which can shrink some coefficients to exactly zero, enabling feature selection. L2 adds squared penalty that shrinks all coefficients toward zero but not exactly. L1 is good for sparse models, L2 handles correlated features better.", l1l2_expected, 3, "Difference between L1 and L2", "L1L2 regression")
assert s >= 2.0, f"L1L2 answer should score >= 2.0, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Null vs Alternative hypothesis")
print("=" * 70)

hyp_expected = "Null hypothesis (H0) is the default assumption of no effect or no difference. Alternative hypothesis (H1 or Ha) is what we want to prove. We test H0 by computing a p-value: if p < significance level (alpha, typically 0.05), we reject H0 in favor of Ha. Type I error: rejecting true H0 (false positive). Type II error: failing to reject false H0 (false negative). Power = 1 - P(Type II error) = probability of correctly rejecting false H0."

concepts = extract_concepts(hyp_expected, "Null vs Alternative hypothesis")
s = test_score("The null hypothesis is the default assumption of no effect. The alternative hypothesis is what we aim to prove. We reject H0 when the p-value is less than the significance level alpha. Failing to reject a false H0 is a Type II error, and rejecting a true H0 is a Type I error.", hyp_expected, 3, "Null vs Alternative hypothesis", "Hypothesis regression")
assert s >= 1.5, f"Hypothesis answer should score >= 1.5, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- ReLU vs Sigmoid vs Tanh")
print("=" * 70)

act_expected = "ReLU: f(x) = max(0, x). Computationally efficient, mitigates vanishing gradient for positive values, but can cause dead neurons (output always 0). Sigmoid: f(x) = 1/(1+e^-x). Output in (0,1), good for probabilities, but suffers from vanishing gradients at extremes and outputs not zero-centered. Tanh: f(x) = (e^x - e^-x)/(e^x + e^-x). Output in (-1,1), zero-centered, but still has vanishing gradient issues. ReLU is default for hidden layers; sigmoid for binary classification output; tanh for RNNs and when zero-centered output helps."

concepts = extract_concepts(act_expected, "ReLU vs Sigmoid vs Tanh")
s = test_score("ReLU outputs max(0,x) and is computationally efficient but can cause dead neurons. Sigmoid outputs values between 0 and 1, useful for probabilities but suffers from vanishing gradients. Tanh outputs between -1 and 1, is zero-centered, but also has vanishing gradient issues at extremes.", act_expected, 3, "ReLU vs Sigmoid vs Tanh", "Activation regression")
assert s >= 2.0, f"Activation answer should score >= 2.0, got {s}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Binomial distribution")
print("=" * 70)

binom_expected = "Binomial distribution models the number of successes in n independent trials, each with probability p of success. Parameters: n (number of trials), p (probability of success). PMF: P(X=k) = C(n,k) * p^k * (1-p)^(n-k). Mean = np, Variance = np(1-p). Each trial has two outcomes (success/failure), trials are independent, and p is constant. Special case: when n=1, it becomes Bernoulli distribution. Approximates normal distribution when n is large and p is not extreme."

concepts = extract_concepts(binom_expected, "Explain binomial distribution")
all_text = " ".join(c['sentence'].lower() for c in concepts)
assert "tf-idf" not in all_text and "word count" not in all_text and "lstm" not in all_text, f"Leakage! {all_text}"
s = test_score("The binomial distribution models the number of successes in a fixed number of independent trials, each with two possible outcomes and the same probability of success. The mean is np and variance is np(1-p).", binom_expected, 2, "Explain binomial distribution", "Binomial regression")
assert s >= 1.5, f"Binomial answer should score >= 1.5, got {s}"
print("  PASS\n")

print("=" * 70)
print("SEMANTIC PARAPHRASE TEST")
print("=" * 70)

para_expected = "TF-IDF weights terms by their inverse document frequency, giving higher importance to words that are rare across documents. Common words appearing in many documents receive lower weight, while rare terms get higher weight."

s = test_score("TF-IDF assigns higher weight to words that are rare across the corpus, so common terms receive lower importance. Terms appearing in fewer documents get higher weight.", para_expected, 3, "What is TF-IDF?", "paraphrase")
assert s >= 2.0, f"Paraphrase should score >= 2.0, got {s}"
print("  PASS\n")

# ══════════════════════════════════════════════════════════════════
# REGRESSION: Score cap — score must NEVER exceed maxMarks
# ══════════════════════════════════════════════════════════════════

print("=" * 70)
print("REGRESSION -- Score cap: Easy (max 2)")
print("=" * 70)

easy_cap_expected = "Overfitting occurs when a model learns the training data too well, including noise, leading to poor performance on unseen or test data. It means the model has high variance and does not generalize."
easy_cap_answer = "Overfitting happens when a model performs very well on training data but poorly on new unseen data. The model captures noise and irrelevant patterns instead of the underlying relationship."

s_easy = test_score(easy_cap_answer, easy_cap_expected, 2, "What is overfitting?", "Easy cap")
assert s_easy <= 2, f"Easy score MUST NOT exceed 2, got {s_easy}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Score cap: Medium (max 3)")
print("=" * 70)

med_cap_expected = "Precision = TP / (TP + FP), measures how many predicted positives are actually positive. Recall = TP / (TP + FN), measures how many actual positives are correctly identified. They trade off: high precision means few false positives; high recall means few false negatives. F1 = 2 x (Precision x Recall) / (Precision + Recall), the harmonic mean balancing both. Use precision when false positives are costly (spam filter: don't mark legitimate email as spam). Use recall when false negatives are costly (disease detection: don't miss sick patients). F1 is preferred when both errors matter and classes are imbalanced."
med_cap_answer = "Precision measures how many predicted positives are actually correct. Recall measures how many actual positives were found. F1 is the harmonic mean balancing both. Use precision when false positives are costly and recall when false negatives are costly."

s_med = test_score(med_cap_answer, med_cap_expected, 3, "Explain precision and recall", "Medium cap")
assert s_med <= 3, f"Medium score MUST NOT exceed 3, got {s_med}"
print("  PASS\n")

print("=" * 70)
print("REGRESSION -- Score cap: Hard (max 5)")
print("=" * 70)

hard_cap_expected = "LSTM is preferred over basic RNN for long-term dependencies because LSTMs solve the vanishing gradient problem through gating mechanisms. The forget gate controls what information to discard from the cell state, the input gate controls what new information to store, and the output gate controls what to output. The cell state acts as a memory highway allowing gradients to flow through time without vanishing, enabling the network to learn long-range dependencies that basic RNNs cannot capture. LSTMs maintain a separate cell state that can preserve information across many time steps."
hard_cap_answer = "LSTMs solve the vanishing gradient problem using gating mechanisms. The cell state acts as a memory highway for long-term dependencies. Gates control information flow: forget gate discards, input gate stores, output gate outputs. This enables learning long-range dependencies that basic RNNs cannot."

s_hard = test_score(hard_cap_answer, hard_cap_expected, 5, "Why is LSTM preferred over basic RNN?", "Hard cap")
assert s_hard <= 5, f"Hard score MUST NOT exceed 5, got {s_hard}"
print("  PASS\n")

print("=" * 70)
print("ALL TESTS PASSED")
print("=" * 70)
