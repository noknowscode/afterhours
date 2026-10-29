// The publish may only warn about trimming inside Uno.Extensions and the view models MVUX generates.
// MVUX emits hot-reload hooks (dynamic binder, TryHotPatch) into every generated view model; they are
// disabled in Release builds, but the trimmer still reports them, and their number grows with each model.
// Every other warning, including any trim warning in code written for this app, fails the build.
const allowed = [
  /warning IL2026: Afterhours\.Uno\.Presentation\.\w+ViewModel\b/,
  /warning IL2026: [^:]*: Using member 'Uno\.Extensions\./,
  /warning IL2104: Assembly 'Uno\.(Extensions|Toolkit)[\w.]*' produced trim warnings/
];

export function unexpectedWarnings(output) {
  const warnings = new Set(output.split(/\r?\n/).filter(line => /: warning [A-Za-z]+\d+/.test(line))
    .map(line => line.replace(/^\s+/, '').replace(/\s+\[[^\]]*\]$/, '')));
  return [...warnings].filter(line => !allowed.some(rule => rule.test(line)));
}
