function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,'&-]/g, '')
    .replace(/\s+/g, ' ');
}

// candidates: [{id, name}]. Returns { match, reason }.
// match is the single candidate object on an exact normalized match.
// reason is 'no_match' or 'ambiguous_match' when match is null, so callers
// never have to guess between multiple same-named records.
function matchByName(targetName, candidates) {
  const normalizedTarget = normalizeName(targetName);
  const matches = candidates.filter((candidate) => normalizeName(candidate.name) === normalizedTarget);

  if (matches.length === 0) {
    return { match: null, reason: 'no_match' };
  }
  if (matches.length > 1) {
    return { match: null, reason: 'ambiguous_match' };
  }
  return { match: matches[0], reason: null };
}

module.exports = { normalizeName, matchByName };
