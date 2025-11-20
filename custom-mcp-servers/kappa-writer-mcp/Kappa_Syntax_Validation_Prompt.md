# Kappa Syntax Validation Guide

This guide provides comprehensive rules and examples for writing correct Kappa code, with special attention to common syntax errors that frequently occur due to AI training data patterns.

# 🔑 CRITICAL: Key Rules - Frequently Broken Patterns

*⚠️ WARNING: These rules contradict common programming language conventions and are deeply embedded in AI training data. They require special attention and should be double-checked before submission.*

## 🚨 TOP PRIORITY: Comment Syntax (C# Standard)
**❌ MOST COMMON MISTAKE:** Using `#` or `/* */` for comments
```kappa
%var: 'k_mod' 0.1      # Wnt modification rate  ❌ WRONG
%var: 'k_bind' 0.01    /* Complex formation */  ❌ WRONG
```

**✅ CORRECT:** Use `//` for ALL comments (follows C# standard)
```kappa
%var: 'k_mod' 0.1      // Wnt modification rate  ✅ CORRECT
%var: 'k_bind' 0.01    // Complex formation     ✅ CORRECT
// This is a single-line comment                ✅ CORRECT
```

**Why Critical:** Most programming languages use `#` (Python, bash) or `/* */` (C, Java), so these patterns are deeply embedded in AI training data. Kappa follows C# comment syntax.

## 🚨 HIGH PRIORITY: State Site Syntax
**❌ FREQUENT MISTAKE:** Using dots or commas between states
```kappa
%agent: Wnt(lipid{u.m})    // ❌ WRONG - dot between states
%agent: LRP(p{u,p})        // ❌ WRONG - comma between states
%agent: Axin(loc{cyt.mem}) // ❌ WRONG - dot between states
```

**✅ CORRECT:** Use spaces between states in state sites
```kappa
%agent: Wnt(lipid{u m})    // ✅ CORRECT - space between states
%agent: LRP(p{u p})        // ✅ CORRECT - space between states
%agent: Axin(loc{cyt mem}) // ✅ CORRECT - space between states
```

**Why Critical:** Most programming languages use dots for object properties (`obj.property`) and commas for lists (`[a,b,c]`), so these patterns are deeply embedded in AI training data. Kappa uniquely uses spaces for state separation.

### 🎯 CRITICAL: Use Comments to Clarify Intent
**ALWAYS add comments to distinguish between binding sites and state sites:**

```kappa
// ✅ CORRECT - Clear comments explaining intent
%agent: Wnt(binding[.], lipid{u m})    // binding=connection site, lipid=state site (u=unmodified, m=modified)
%agent: Fz(wnt[.], dsh[.])            // wnt=connection site, dsh=connection site
%agent: LRP(wnt[.], p{u p})           // wnt=connection site, p=state site (u=unphosphorylated, p=phosphorylated)
%agent: Axin(b[.], loc{cyt mem})      // b=connection site, loc=state site (cyt=cytoplasm, mem=membrane)
```

**Comment Guidelines:**
- **Connection sites `[.]`:** Comment as "connection site" or "binding site"
- **State sites `{states}`:** Comment as "state site" and define what each state means
- **Define abbreviations:** Always explain what `u`, `m`, `p`, `cyt`, `mem`, etc. mean
- **Intent verification:** Comments help humans verify the correct syntax choice

**Why This is Critical:** Comments serve as a human-readable check to ensure the correct syntax (dots vs spaces) is used based on the intended functionality.

### ⚠️ WARNING: Check for Unclear Intent Comments
**When reviewing Kappa code, ALWAYS check for unclear intent comments and call them out:**

**🚨 WARNING PATTERNS TO FLAG:**
```kappa
// ❌ UNCLEAR - Missing intent explanation
%agent: Wnt(binding[.], lipid{u m})    // u=unmodified, m=modified

// ❌ UNCLEAR - No comment at all
%agent: Wnt(binding[.], lipid{u m})

// ❌ UNCLEAR - Vague comment
%agent: Wnt(binding[.], lipid{u m})    // states
```

**✅ CORRECT - Clear intent explanation:**
```kappa
%agent: Wnt(binding[.], lipid{u m})    // binding=connection site, lipid=state site (u=unmodified, m=modified)
```

**🚨 WARNING MESSAGE TO USE:**
```
⚠️ WARNING: Unclear Intent Comments Detected!

The following agent declarations lack clear intent comments:
- [List specific lines]

🚨 CRITICAL: Without clear comments, it's impossible to verify:
- Which sites are connection sites (should use [.])
- Which sites are state sites (should use {states})
- What each state abbreviation means (u, m, p, etc.)

🔧 FIX: Add comments explaining:
- "connection site" or "binding site" for [.] sites
- "state site" and define each state for {states} sites
- Define all abbreviations (u=unmodified, m=modified, etc.)

Example fix:
%agent: Wnt(binding[.], lipid{u m})    // binding=connection site, lipid=state site (u=unmodified, m=modified)
```

**This warning helps prevent syntax errors and ensures code clarity!**

## 🚨 MEDIUM PRIORITY: Variable Names
**❌ COMMON MISTAKE:** Unquoted variable names
```kappa
%var: k_mod 0.1        // ❌ WRONG - unquoted
%var: k_bind 0.01      // ❌ WRONG - unquoted
```

**✅ CORRECT:** Always quote variable names
```kappa
%var: 'k_mod' 0.1      // ✅ CORRECT - quoted
%var: 'k_bind' 0.01    // ✅ CORRECT - quoted
```

**Why Critical:** Most programming languages don't require quotes for variable names, so this pattern contradicts training data.

## 🚨 MEDIUM PRIORITY: Link Identifier Consistency
**❌ COMMON MISTAKE:** Inconsistent link identifiers in rules
```kappa
// ❌ WRONG - Link '1' doesn't exist on left side
'Wnt_LRP_complex_formation'
    Wnt(binding[1]), LRP(Wnt_binding[.], phosphorylation{u}) ->
    Wnt(binding[1]), LRP(Wnt_binding[1], phosphorylation{u}) @ 'k_complex'

// ❌ WRONG - Trying to create bond with non-existent link
'Frizzled_LRP_complex_formation'
    Frizzled(Wnt_binding[1], LRP_binding[.]), 
    LRP(Frizzled_binding[.], phosphorylation{u}) ->
    Frizzled(Wnt_binding[1], LRP_binding[2]), 
    LRP(Frizzled_binding[2], phosphorylation{u}) @ 'k_complex'
```

**✅ CORRECT:** Link identifiers must be consistent and exist where used
```kappa
// ✅ CORRECT - Both agents start unbound, then bind
'Wnt_LRP_complex_formation'
    Wnt(binding[.]), LRP(Wnt_binding[.], phosphorylation{u}) ->
    Wnt(binding[1]), LRP(Wnt_binding[1], phosphorylation{u}) @ 'k_complex'

// ✅ CORRECT - Frizzled already bound to Wnt, then binds LRP
'Frizzled_LRP_complex_formation'
    Frizzled(Wnt_binding[1], LRP_binding[.]), 
    LRP(Frizzled_binding[.], phosphorylation{u}) ->
    Frizzled(Wnt_binding[1], LRP_binding[2]), 
    LRP(Frizzled_binding[2], phosphorylation{u}) @ 'k_complex'
```

**Error Message:** "The link 'X' occurs only one time in the mixture"
**Cause:** Trying to use a link identifier that doesn't exist on the left side of the rule
**Fix:** Ensure link identifiers are consistent - if you use `[1]` on one side of a bond, use `[1]` on the other side, and the link must exist in the context where it's being used

**Why Critical:** This error is common when copying/modifying rules without understanding the link identifier system. Link identifiers must be consistent across the entire rule.

---

## 🔍 Key Rules Checklist (Check Before Submission)
- [ ] **Comments:** All comments use `//` (C# standard), not `#` or `/* */`
- [ ] **State Sites:** All states separated by spaces, not dots or commas
- [ ] **Variables:** All variable names are quoted strings
- [ ] **Link Identifiers:** All link identifiers are consistent and exist where used
- [ ] **Intent Comments:** All sites have comments explaining binding vs state intent
- [ ] **State Definitions:** All state abbreviations (u, m, p, etc.) are defined in comments
- [ ] **Line Breaks:** Each agent declaration, rule, observable, and variable on its own line
- [ ] **No training data conflicts:** Double-check against common programming patterns

## 🚨 HIGH PRIORITY: Code Formatting and Line Breaks

**❌ COMMON MISTAKE:** Putting multiple declarations on the same line
```kappa
%agent: Wnt(binding, modum) // Added lipid modification state %agent: Fz(wnt, lrp, dsh) // Frizzled receptor %agent: LRP(fz, axin, pup) // LRP co-receptor %agent: Axin(lrp, btcat, apc) // Scaffold protein %agent: APC(axin, btcat) // Tumor suppressor %agent: BetaCatenin(axin, apc, tcf, pup) // β-catenin %agent: TCF(btcat, gro) // Transcription factor %agent: Groucho(tcf) // Repressor
```

**✅ CORRECT:** Each declaration on its own line with proper spacing
```kappa
// Extended agents with additional sites and states
%agent: Wnt(binding, modum)        // Added lipid modification state
%agent: Fz(wnt, lrp, dsh)          // Frizzled receptor
%agent: LRP(fz, axin, pup)         // LRP co-receptor
%agent: Axin(lrp, btcat, apc)      // Scaffold protein
%agent: APC(axin, btcat)           // Tumor suppressor
%agent: BetaCatenin(axin, apc, tcf, pup)  // β-catenin
%agent: TCF(btcat, gro)            // Transcription factor
%agent: Groucho(tcf)               // Repressor
```

**Why Critical:** 
- Kappa code is much more readable when each declaration is on its own line
- Makes debugging and validation easier
- Follows standard programming practices for code organization
- Prevents confusion when multiple agents are declared together

**Formatting Rules:**
- Each `%agent:`, `%rule:`, `%obs:`, `%var:`, and `%init:` declaration gets its own line
- Add blank lines between logical groups (agents, rules, observables, etc.)
- Align comments for better readability
- Use consistent indentation for multi-line rules

---

# Regular Kappa Syntax Rules

## 1. Agent Declarations (`%agent:`)
**✅ CORRECT:**
```kappa
%agent: Wnt(binding[.], lipid{u m})  // Multiple states separated by spaces
%agent: Fz(wnt[.], dsh[.])           // Simple sites
%agent: Bcat(p{u p}, ub{n y})       // Multiple states per site
```

**Rules:**
- Multiple states must be separated by spaces, not dots or commas
- Use format: `site{state1 state2}`
- Sites can have multiple states: `{u p}` for unphosphorylated/phosphorylated
- Connection sites use `[.]` for binding capability
- State sites use `{states}` for internal states

## 2. Initial Conditions (`%init:`)
**✅ CORRECT:**
```kappa
%init: 100 Wnt(binding[.], lipid{u})
%init: 100 Bcat(p{u}, ub{n})
%init: 50 Wnt(binding[1], lipid{u}), Fz(wnt[1], dsh[.])  // Connected complex
```

**Rules:**
- Specify quantity and agent state
- Use single states in initial conditions: `{u}`, not `{u m}`
- Can initialize connected complexes
- Ensure agents can participate in reactions (avoid dead agents)

## 3. Observables (`%obs:`)
**✅ CORRECT:**
```kappa
%obs: 'total_wnt' |Wnt()|
%obs: 'bound_wnt' |Wnt(binding[_])|
%obs: 'modified_wnt' |Wnt(lipid{m})|
```

**Rules:**
- Always use pipes `|` around patterns
- Quote observable names
- Use `_` for any binding state in patterns
- Use specific states for modified forms

## 4. Rules
**✅ CORRECT:**
```kappa
'wnt_fz_bind' Wnt(binding[.]), Fz(wnt[.]) -> Wnt(binding[1]), Fz(wnt[1]) @ 'k_bind'
'wnt_mod' Wnt(lipid{u}) -> Wnt(lipid{m}) @ 'k_mod'
'dissociation' Wnt(binding[1]), Fz(wnt[1]) -> Wnt(binding[.]), Fz(wnt[.]) @ 'k_unbind'
```

**Rules:**
- Always quote rule names
- Use proper binding syntax: `[.]` for free, `[1]` for bound
- Specify rate constants with quotes
- Use reversible rules `<->` when appropriate

## 5. Variables (`%var:`)
**✅ CORRECT:**
```kappa
%var: 'k_bind' 0.01    // Binding rate constant
%var: 'k_unbind' 0.001 // Unbinding rate constant
%var: 'k_mod' 0.1      // Modification rate constant
```

**Rules:**
- Always quote variable names
- Use descriptive names
- Include units in comments
- Use consistent naming conventions

## Pre-Submission Checklist

Before submitting any Kappa code, verify:

### 🔑 Key Rules Check (CRITICAL)
- [ ] **Comments:** All comments use `//` (C# standard), not `#` or `/* */`
- [ ] **State Sites:** All states separated by spaces, not dots or commas  
- [ ] **Variables:** All variable names are quoted strings
- [ ] **Link Identifiers:** All link identifiers are consistent and exist where used
- [ ] **Intent Comments:** All sites have comments explaining binding vs state intent
- [ ] **State Definitions:** All state abbreviations (u, m, p, etc.) are defined in comments
- [ ] **No training data conflicts:** Double-check against common programming patterns

### 📋 General Syntax Check
- [ ] Agent declarations are properly formatted
- [ ] Initial conditions specify single states
- [ ] Observables use pipe delimiters
- [ ] Rules have quoted names and proper syntax
- [ ] Variables are quoted and descriptive
- [ ] No syntax errors in patterns
- [ ] All agents can participate in reactions (no dead agents)
- [ ] **Each declaration on its own line** (no cramming multiple declarations together)
- [ ] **Proper spacing and line breaks** for readability

## Common Error Patterns to Avoid

1. **State Separation**: Use spaces, not dots or commas
   - ❌ `{u.m}` → ✅ `{u m}`
   - ❌ `{n.y}` → ✅ `{n y}`

2. **Observable Delimiters**: Always use pipes
   - ❌ `Wnt(lipid{m})` → ✅ `|Wnt(lipid{m})|`

3. **Rule Labels**: Always quote rule names
   - ❌ `Rule_name` → ✅ `'Rule_name'`

4. **Initial States**: Single states only
   - ❌ `Wnt(lipid{u m})` → ✅ `Wnt(lipid{u})`

5. **Site Binding**: Use proper brackets
   - ❌ `binding(1)` → ✅ `binding[1]`
   - ❌ `wnt.` → ✅ `wnt[.]`

6. **Comment Syntax**: Use C# standard
   - ❌ `# comment` → ✅ `// comment`
   - ❌ `/* comment */` → ✅ `// comment`

7. **Link Identifiers**: Must be consistent and exist where used
   - ❌ `Wnt(binding[1]), LRP(wnt[.]) -> Wnt(binding[1]), LRP(wnt[1])` → ✅ `Wnt(binding[.]), LRP(wnt[.]) -> Wnt(binding[1]), LRP(wnt[1])`
   - ❌ Error: "The link '1' occurs only one time in the mixture"

8. **Code Formatting**: Each declaration on its own line
   - ❌ `%agent: Wnt(binding) %agent: Fz(wnt) %agent: LRP(fz)` → ✅ Each on separate line
   - ❌ `%rule: 'bind' Wnt(binding[.]), Fz(wnt[.]) -> Wnt(binding[1]), Fz(wnt[1]) %obs: |Wnt(binding[1])|` → ✅ Each on separate line
   - ❌ Multiple declarations crammed together → ✅ Proper line breaks and spacing

9. **Greek Letters in Biology**: Always spell out, never use Unicode
   - ❌ `β_catenin` → ✅ `beta_catenin`
   - ❌ `α_synuclein` → ✅ `alpha_synuclein`
   - ❌ `κ_receptor` → ✅ `kappa_receptor`
   - ❌ `δ_opioid` → ✅ `delta_opioid`
   - ❌ `γ_aminobutyric` → ✅ `gamma_aminobutyric`
   - ❌ `β_amyloid` → ✅ `beta_amyloid`
   - ❌ `α_helix` → ✅ `alpha_helix`
   - ❌ `κ_light_chain` → ✅ `kappa_light_chain`

## Validation Template

Use this template to check your code:

```kappa
// 1. Check agent declarations
%agent: AgentName(site1{state1 state2}, site2[.])
// ✓ Multiple states separated by spaces
// ✓ Proper site syntax

// 2. Check initial conditions  
%init: 100 AgentName(site1{state1}, site2[.])
// ✓ Single state per site
// ✓ Proper quantity specification

// 3. Check observables
%obs: 'obs_name' |AgentName(site1{state1})|
// ✓ Quoted name
// ✓ Pipe delimiters

// 4. Check rules
'rule_name' Agent1(site[.]), Agent2(site[.]) -> Agent1(site[1]), Agent2(site[1]) @ 'rate'
// ✓ Quoted rule name
// ✓ Proper binding syntax
// ✓ Quoted rate constant

// 5. Check variables
%var: 'var_name' 0.01
// ✓ Quoted variable name
// ✓ Proper value format
```

## Final Validation Steps

1. **Run through Key Rules checklist** - Most critical step
2. **Check for dead agents** - Ensure all agents can participate in reactions
3. **Validate syntax** - Use KaSim to check for errors
4. **Test simulation** - Run a short simulation to verify functionality

Remember: The Key Rules are the most important - they address patterns that contradict AI training data and are frequently broken!

---

# 🔍 Supplemental: Surprising Kappa Patterns (Based on Training Data Conflicts)

*These patterns are surprising because they contradict common programming language conventions and may not be immediately obvious from training data.*

## 🚨 Dead Agents vs Dead Rules
**Training Data Expectation:** "Dead" usually means unused code or unreachable code
**Kappa Reality:** Two distinct concepts with specific meanings

### Dead Agents
- **Definition:** Agents that cannot participate in any reactions
- **Cause:** Agents initialized without proper connections or in states that prevent interaction
- **Example:** `%init: 100 Wnt(binding[.], lipid{u})` with no rules that can act on free Wnt
- **Fix:** Ensure agents are initialized in connected states or have rules that can act on them

### Dead Rules  
- **Definition:** Rules that can never be applied from the initial state
- **Cause:** Rules that require agent states/connections that are never created
- **Example:** Rule requiring `Wnt(binding[1])` but Wnt is always initialized as `Wnt(binding[.])`
- **Fix:** Ensure rules can match against possible agent states

## 🚨 Site State Notation in Analysis Output
**Training Data Expectation:** `[.]` and `[1]` look like array indexing
**Kappa Reality:** Binding state notation with specific meanings

### Analysis Output Patterns
```kappa
// What you might see in KaSim analysis:
E(x) => [ E(x[.]) v E(x[x.R]) ]
R(c) => [ R(c[.]) v R(c[c.R]) ]
```

**Training Data Confusion:** This looks like array access or object properties
**Kappa Meaning:** 
- `x[.]` = site x is free (can bind)
- `x[x.R]` = site x is bound to site R of agent x
- `c[c.R]` = site c is bound to site R of agent c

## 🚨 Relational Properties Syntax
**Training Data Expectation:** `v` looks like a logical OR operator
**Kappa Reality:** Disjunction in reachability analysis

### Analysis Output Example
```kappa
R() =>
[
  R(c[.],cr[.],n[.],x[x.E])
v R(c[c.R],cr[n.R],n[.],x[x.E])
v R(c[c.R],cr[.],n[.],x[x.E])
]
```

**Training Data Confusion:** This looks like complex boolean logic
**Kappa Meaning:** These are alternative states the system can reach - the agent R can exist in any of these configurations

## 🚨 Causality Analysis Syntax
**Training Data Expectation:** `$TRACK` looks like a shell command or macro
**Kappa Reality:** Special KaSim directive for causality analysis

### Causality Directives
```kappa
%mod: [true] do $TRACK 'Cpp'[true];   // Turn on causality tracking
%mod: [T]>25 do $TRACK 'Cpp'[false];  // Turn off after time 25
```

**Training Data Confusion:** `$TRACK` looks like a shell variable or command
**Kappa Meaning:** Special KaSim instruction for tracking causal relationships between rule applications

## 🚨 Counter Syntax (If Used)
**Training Data Expectation:** Counters look like variables or arrays
**Kappa Reality:** Special agent sites for counting

### Counter Example
```kappa
%agent: Counter(count{0..10})  // Counter with range 0-10
```

**Training Data Confusion:** This looks like array initialization or range syntax
**Kappa Meaning:** Site `count` can hold integer values from 0 to 10

## 🚨 Intervention Syntax
**Training Data Expectation:** `%mod:` looks like a preprocessor directive
**Kappa Reality:** Conditional modification directive

### Intervention Example
```kappa
%mod: [T]>10 do $ADD Wnt(binding[.], lipid{u}) 100;
```

**Training Data Confusion:** This looks like C preprocessor or configuration syntax
**Kappa Meaning:** At time T > 10, add 100 Wnt agents to the system

## 🚨 CRITICAL: Character Encoding Issues

**❌ NEVER use special Unicode characters that may not be recognized by all systems:**

### Greek Letters - Always Spell Out
- `β` → `beta`
- `α` → `alpha` 
- `γ` → `gamma`
- `δ` → `delta`
- `ε` → `epsilon`
- `θ` → `theta`
- `λ` → `lambda`
- `μ` → `mu`
- `π` → `pi`
- `σ` → `sigma`
- `τ` → `tau`
- `φ` → `phi`
- `ψ` → `psi`
- `ω` → `omega`

### Other Problematic Characters
- `→` → `->` (use ASCII arrow)
- `←` → `<-` (use ASCII arrow)
- `≥` → `>=` (use ASCII comparison)
- `≤` → `<=` (use ASCII comparison)
- `≠` → `!=` (use ASCII comparison)
- `±` → `+/-` (use ASCII plus/minus)
- `×` → `x` (use ASCII x)
- `÷` → `/` (use ASCII division)
- `∞` → `infinity` (spell out)
- `∂` → `partial` (spell out)
- `∫` → `integral` (spell out)
- `∑` → `sum` (spell out)
- `∏` → `product` (spell out)
- `√` → `sqrt` (use ASCII abbreviation)
- `∆` → `delta` (spell out)
- `°` → `degrees` (spell out)

### Mathematical Symbols
- `∈` → `in` (use ASCII word)
- `∉` → `not in` (use ASCII words)
- `⊂` → `subset` (spell out)
- `⊃` → `superset` (spell out)
- `∪` → `union` (spell out)
- `∩` → `intersection` (spell out)
- `∅` → `empty` (spell out)

### Special Punctuation
- `"` → `"` (use straight quotes)
- `"` → `"` (use straight quotes)
- `'` → `'` (use straight apostrophe)
- `'` → `'` (use straight apostrophe)
- `–` → `-` (use ASCII hyphen)
- `—` → `--` (use ASCII double hyphen)
- `…` → `...` (use ASCII dots)

**✅ CORRECT Examples:**
```kappa
%agent: Wnt(beta_catenin[.], lipid{u m})  // beta instead of β
%var: 'k_alpha' 0.1                      // alpha instead of α
%var: 'k_gamma' 0.05                     // gamma instead of γ
%var: 'k_lambda' 0.02                    // lambda instead of λ
```

**❌ WRONG Examples:**
```kappa
%agent: Wnt(β_catenin[.], lipid{u m})    // β not recognized
%var: 'k_α' 0.1                          // α not recognized  
%var: 'k_γ' 0.05                         // γ not recognized
%var: 'k_λ' 0.02                         // λ not recognized
```

**Why Critical:** Many systems, terminals, and parsers don't properly handle Unicode characters, especially in scientific contexts. Always use ASCII-compatible characters to ensure maximum compatibility.

## 🚨 Why These Are Surprising

1. **Notation Overlap:** Kappa uses symbols (`[.]`, `v`, `$`) that have different meanings in common programming languages
2. **Domain-Specific:** These concepts (dead agents, causality analysis, reachability) are specific to rule-based modeling
3. **Analysis Output:** The formal analysis output uses mathematical notation that looks like programming syntax
4. **Special Directives:** KaSim has its own set of special commands that don't follow typical programming conventions

## 🎯 Key Takeaway

When working with KaSim analysis output or advanced features, remember that Kappa has its own domain-specific notation that may look familiar but has completely different meanings than in general programming languages. Always refer to the KaSim documentation for the correct interpretation of these patterns.