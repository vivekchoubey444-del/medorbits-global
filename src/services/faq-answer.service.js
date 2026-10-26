
'use strict';

const path = require('node:path');
const fs = require('node:fs');

const FAQ_PATH = path.resolve(
  __dirname,
  '../../assets/data/faqs.json',
);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'may', 'me', 'my',
  'of', 'on', 'or', 'our', 'please', 'should', 'so', 'than', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'to', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

const MIN_MATCH_SCORE = 2;
const MAX_QUERY_LENGTH = 500;
const MAX_FAQ_ENTRIES = 10000;
const MAX_ANSWER_LENGTH = 20000;

let cachedFaqs = null;
let cachedMtimeMs = null;

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/u)
    .filter(
      (word) => word.length > 1 && !STOP_WORDS.has(word),
    );
}

function loadFaqs() {
  let stat;

  try {
    stat = fs.statSync(FAQ_PATH);
  } catch {
    return [];
  }

  if (
    cachedFaqs !== null &&
    cachedMtimeMs === stat.mtimeMs
  ) {
    return cachedFaqs;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(FAQ_PATH, 'utf8'),
    );

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.faqs)
    ) {
      cachedFaqs = [];
      cachedMtimeMs = stat.mtimeMs;
      return cachedFaqs;
    }

    cachedFaqs = parsed.faqs
      .slice(0, MAX_FAQ_ENTRIES)
      .filter(isValidFaq);

    cachedMtimeMs = stat.mtimeMs;

    return cachedFaqs;
  } catch {
    // Fail closed: malformed FAQ data produces no answer.
    return [];
  }
}

function isValidFaq(item) {
  return Boolean(
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    item.active === true &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 128 &&
    typeof item.question === 'string' &&
    item.question.trim().length > 0 &&
    item.question.length <= 1000 &&
    typeof item.answer === 'string' &&
    item.answer.trim().length > 0 &&
    item.answer.length <= MAX_ANSWER_LENGTH,
  );
}

function getFaqWords(item) {
  return new Set([
    ...tokenize(item.question),
    ...tokenize(item.category),
    ...(Array.isArray(item.tags)
      ? item.tags
          .filter((tag) => typeof tag === 'string')
          .flatMap(tokenize)
      : []),
  ]);
}

function calculateScore(queryWords, faqWords) {
  let score = 0;

  for (const word of queryWords) {
    if (faqWords.has(word)) {
      score += 1;
    }
  }

  return score;
}

function findAnswer(question) {
  if (
    typeof question !== 'string' ||
    question.trim().length === 0 ||
    question.length > MAX_QUERY_LENGTH
  ) {
    return null;
  }

  const normalizedQuery = normalizeText(question);
  const queryWords = new Set(tokenize(question));

  if (!normalizedQuery || queryWords.size === 0) {
    return null;
  }

  const entries = loadFaqs();

  let best = null;
  let bestScore = 0;

  for (const item of entries) {
    const faqWords = getFaqWords(item);
    let score = calculateScore(queryWords, faqWords);

    const normalizedFaqQuestion = normalizeText(item.question);

    // Give a modest preference to exact or phrase-level matches.
    if (
      normalizedQuery.length >= 8 &&
      normalizedFaqQuestion.includes(normalizedQuery)
    ) {
      score += 3;
    } else if (
      normalizedFaqQuestion.length >= 8 &&
      normalizedQuery.includes(normalizedFaqQuestion)
    ) {
      score += 2;
    }

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  if (!best || bestScore < MIN_MATCH_SCORE) {
    return null;
  }

  return {
    id: best.id,
    question: best.question,
    answer: best.answer,
    category:
      typeof best.category === 'string'
        ? best.category
        : null,
    score: bestScore,
  };
}

function clearFaqCache() {
  cachedFaqs = null;
  cachedMtimeMs = null;
}

module.exports = {
  findAnswer,
  tokenize,
  loadFaqs,
  clearFaqCache,
  MIN_MATCH_SCORE,
};
