# The Kappa Language and Kappa Tools
## A User Manual and Guide
### Version 4

**Author:** Walter Fontana  
**Developers:** Pierre Boutillier, Jérôme Feret, Jean Krivine  
**Website:** KappaLanguage.org  
**Date:** October 30, 2024

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Background](#11-background)
   - 1.2 [Support](#12-support)
   - 1.3 [Hello ABC](#13-hello-abc)
2. [The Kappa Language](#2-the-kappa-language)
   - 2.1 [Names and Labels](#21-names-and-labels)
   - 2.2 [Pattern Expressions](#22-pattern-expressions)
   - 2.3 [Rule Expressions](#23-rule-expressions)
   - 2.4 [Kappa Declarations](#24-kappa-declarations)
   - 2.5 [Intervention Directives](#25-intervention-directives)
3. [Simulation](#3-simulation)
   - 3.1 [Matching](#31-matching)
   - 3.2 [Symmetry](#32-symmetry)
   - 3.3 [Rule Activity](#33-rule-activity)
   - 3.4 [The Core Loop](#34-the-core-loop)
   - 3.5 [The Rate Constant](#35-the-rate-constant)
4. [Appendices](#4-appendices)

---

# 1. Introduction

This manual aims at providing an up-to-date description of the Kappa language and accompanying software tools. It is a work in progress. We welcome feedback, but keep in mind that a manual is not a modeling tutorial.

## 1.1 Background

Kappa is a rule-based modeling language. More specifically, it is a graph-rewrite language supported by software for representing, reasoning about, and simulating systems of interacting structured entities (graphs). The insistence on a grammatical structure distinguishes rule-based models from generic agent-based models.

Kappa follows the same idea underlying the symbolic representation of organic molecules as graphs and the specification of their transformations as graph-rewrite directives. In chemistry, the concept of a rule emphasizes the distinction between the transformation of a structure fragment and the reaction instance that results when that fragment is transformed within the context of specific entities that contain it. In this sense, a rule represents the mechanism of an interaction. That is precisely the intended meaning of a rule in Kappa.

**Figure 1: Graph rewriting in chemistry and Kappa**

In chemistry, atoms have specific valences through which they bind other atoms. In Kappa, proteins (here blue nodes with a type identified by a name) have sites (here small nodes attached to the blue nodes and identified by names) through which they bind other proteins. In addition to their binding state, sites can hold internal state (here color marks) typically denoting post-translational modifications. A rule specifies the transformation of a graphical fragment. In Kappa as in chemistry, when the fragment on the left hand side of a rule can be matched to a target graph, the matched part is rewritten in place giving rise to a reaction.

Kappa originated with in mind applications to systems of protein-protein interaction where "structured entities" are complexes of non-covalently bound proteins as they arise in signaling and assembly processes. In Kappa, individual proteins appear as agents with a minimal abstract structure given by an interface of sites that hold state required for interaction, such as binding and post-translational modification. This said, Kappa is perhaps best thought of as a versatile framework for thinking about the statistical dynamics induced by the mass-action of interacting heterogeneous agents, regardless of how one chooses to interpret them.

Because rules avoid the need to pre-specify all possible molecular species, they enable reasoning about the behavior of systems that are marked by combinatorially explosive complexity. Rule-based models can be concise, transparent, and readily extensible, making them candidates for supporting model-based reasoning in bioinformatics.

## 1.2 Support

The Kappa portal, http://kappalanguage.org, is the easiest way to access the latest software (and previous versions). The ecology of Kappa tools consists of several software agents that communicate through an ad hoc JSON-based protocol and expose high-level functionalities through an HTTP REST service. A Python client (API) enables scripting to tailor work flows and is available as the kappa package in pip.

Modeling in a rule-based language is much like writing large and complex programs, which is greatly facilitated by an integrated development environment. An evolving browser-based User Interface (UI) is aimed at integrating various Kappa web services. The UI is accessible online and also available as a self-contained downloadable application referred to as the Kappa app.

**Figure 2: Elements of the Kappa UI**

Left: Main window with editor and contact graph. Center: XY plots of observables. Right: Patchwork (treemap) rendering of the system contents at a particular time point.

At one glance:
- Items of general interest and downloads can be found at http://kappalanguage.org
- Bug reports should be posted to https://github.com/Kappa-Dev/KaSim/issues
- The Kappa-user mailing list at http://groups.google.com/group/kappa-users is a quick way for asking questions, finding answers, or sharing frustration.
- If you wish to contribute to the Kappa project, please contact Pierre Boutillier.

## 1.3 Hello ABC

To get a quick intuition about what a Kappa model looks like, consider the following simple system, which is also pre-loaded and ready to run in the online version of the UI.

In this toy model, agents of type A can doubly phosphorylate agents of type C. However, unphosphorylated C can bind A only in a complex with B. Once phosphorylated, C can bind an individual A, which then phosphorylates C on a second site. The verbal statement of such a model is highly underspecified. To make precise what we mean, we pin down its mechanisms in terms of clear rules.

```kappa
// Signatures
%agent: A(x,c)  // Declaration of agent A
%agent: B(x)    // Declaration of agent B  
%agent: C(x1{u p},x2{u p})  // Declaration of agent C

// Variables
%var: 'on_rate' 1.0E-4  // per molecule per second
%var: 'off_rate' 0.1     // per second
%var: 'mod_rate' 1       // per second

// Rules

// A and B bind and dissociate:
'rule1' A(x[.]), B(x[.]) <-> A(x[1]), B(x[1]) @ 'on_rate', 'off_rate'

// AB binds unphosphorylated C:
'rule2' A(x[_],c[.]), C(x1{u}[.]) -> A(x[_],c[2]), C(x1{u}[2]) @ 'on_rate'

// site x1 is modified:
'rule3' C(x1{u}[1]), A(c[1]) -> C(x1{p}[.]), A(c[.]) @ 'mod_rate'

// A conditionally binds C:
'rule4' A(x[.],c[.]), C(x1{p}[.],x2{u}[.]) -> A(x[.],c[1]), C(x1{p}[.],x2{u}[1]) @ 'on_rate'

// site x2 is modified:
'rule5' A(x[.],c[1]), C(x1{p}[.],x2{u}[1]) -> A(x[.],c[.]), C(x1{p}[.],x2{p}[.]) @ 'mod_rate'

// Observables
%obs: 'AB' |A(x[x.B])|
%obs: 'Cuu' |C(x1{u},x2{u})|
%obs: 'Cpu' |C(x1{p},x2{u})|
%obs: 'Cpp' |C(x1{p},x2{p})|

// Initial condition
%init: 1000 A(), B()
%init: 10000 C(x1{u},x2{u})
```

A file with these sections is also referred to as a "Kappa file". The signatures section declares for each agent a set of sites (its interface) and the possible values each site can take. For example, the declaration of agent C informs us that agents of type C have two sites x1 and x2 whose internal state may have the label u (for unphosphorylated, say) or p (for phosphorylated). In addition to their binding state, sites can hold internal state (here color marks) typically denoting post-translational modifications.

---

# 2. The Kappa Language

We overload the term Kappa language (or Kappa for short) with both a broad and a narrow meaning. In a narrow sense, Kappa refers to a language for specifying patterns of certain graphs—"site graphs". The narrow sense also includes rules that specify the rewriting of such patterns. Understood in a broad sense, Kappa includes the above plus a collection of declarations with which inputs are provided to the simulator KaSim. These inputs enable the execution of a model and the observation of its behavior.

A Kappa model consists of a set of files whose concatenation constitutes the Kappa input file or KF for short. The KF serves as input to the Kappa tool in question, usually KaSim. This input could be a single file, but splitting it up can be convenient.

A KF consists of declarations, which can be:
- rules (section 2.3)
- variables (section 2.4.1)
- signatures of agents (section 2.4.2) and tokens (section 2.4.5)
- initial conditions (section 2.4.3)
- intervention directives (section 2.5)
- configuration settings (section 2.4.4)

## 2.1 Names and Labels

The name construct Name refers to any string generated by the regular expressions indicated below. It is used to name agents, sites, states, and variables. The Label construct is similar, but must be in single quotes. It can contain any sequence of characters, excluding the newline or the quote characters. A Label is used to name rules.

**Grammar 1: Names and labels**
```
Name ::= [a-zA-Z][a-zA-Z0-9_~+]*  // cannot start with a digit
       | [_][a-zA-Z0-9_~+]+       // initial underscore can't standalone
Label ::= '[^\n']+'               // no newline or single quote in a label
```

## 2.2 Pattern Expressions

A Kappa expression denotes a site graph. In a site graph, nodes possess a set of sites, called the interface of the node. The sites, not the nodes themselves, are the endpoints of edges. A site graph formalizes the resources that an interaction requires, such as physical surfaces in the case of a binding interaction.

The name of an agent denotes its type. Thus, RAS denotes a type of protein, not a specific instance. To tell it from other instances of the same type, a node in a graph has an associated identifier (nodeid). The node id is (typically) not explicitly mentioned in graphical or line-oriented expressions as it is implicit in the node layout or the sequence of agent occurrences, respectively.

**Grammar 2: Pattern expressions**
```
pattern ::= agent more-pattern
agent-name ::= Name
site-name ::= Name
state-name ::= Name
agent ::= agent-name(interface)
site ::= site-name internal-state link-state
       | site-name link-state internal-state
       | counter  // see Grammar 14
interface ::= site more-interface
            | .
more-pattern ::= [,] pattern
               | .
more-interface ::= [,] site more-interface
                 | .
internal-state ::= {state-name}
                 | {#}  // wildcard
                 | .
link-state ::= [number]
            | [.]
            | [_]
            | [#]  // wildcard
            | [site-name.agent-name]
            | .
number ::= n ∈ N₀
```

We distinguish two kinds of site graphs: contact graphs and patterns. A contact graph is a site graph where every agent node has a different name and a site can be the endpoint of multiple edges. Contact graphs represent a static summary of all agent types that occur in a model alongside their potential binding interactions. A pattern, on the other hand, is a site graph that can contain multiple nodes with the same name, representing different agents of the same type, but each site can be the endpoint of at most one edge.

## 2.3 Rule Expressions

Rules have the basic shape L → R. The intended meaning is that the right-hand side graph R replaces the left-hand side graph L. This replacement usually occurs in the context of a larger graph G (for example representing a molecular species) that matches L. Matching here means that L is subgraph-isomorphic to G.

There are two ways of specifying rules:

1. **The arrow notation (or chemical format)**: This is the familiar format, L → R, in which the "before" (L) and the "after" (R) are two pattern expressions. The arrow requires a mapping between L and R that specifies which agents in L corresponds to which agents in R.

2. **The edit notation**: This is more compact and avoids the need of a mapping between two pattern expressions by simply writing edit directives into the "before" pattern.

Both styles are understood by the parser and can be freely mixed. Regardless of style, rules can be prefixed by a name and must end with rate information.

### 2.3.1 Arrow Notation

The syntax of the arrow notation is specified in Grammar 3.

**Grammar 3: Rule expressions in arrow notation**
```
f-rule ::= [Label] rule-expression [| token] @ rate
fr-rule ::= [Label] rev-rule-expression [| token] @ rate, rate
ambi-rule ::= [Label] rule-expression [| token] @ rate {rate}
ambi-fr-rule ::= [Label] rev-rule-expression [| token] @ rate {rate}, rate
rule-expression ::= (agent | .) more → (agent | .)
more ::= ,(agent | .) more (agent | .),
       | .
rev-rule-expression ::= (agent | .) rev-more (agent | .)
rev-more ::= ,(agent | .) rev-more (agent | .),
           | <→>
rate ::= algebraic-expression
```

### 2.3.2 Edit Notation

In the edit notation, state modifications are directly indicated for each site with a "before" / "after" syntax; agent destruction (creation) is annotated with a "−" ("+") sign following the respective agent.

**Grammar 4: Rule expressions in edit notation**
```
f-rule ::= [Label] f-rule-expression [| token] @ rate
ambi-rule ::= [Label] f-rule-expression [| token] @ rate {rate}
f-rule-expression ::= agent-mod more-agent-mod
                    | .
more-agent-mod ::= , agent-mod more-agent-mod
                 | .
agent-mod ::= agent-name(interface-mod)
            | agent-name(interface) (+ | −)
site-mod ::= site-name internal-state-mod link-state-mod
          | site-name link-state-mod internal-state-mod
          | counter-name counter-state-mod
interface-mod ::= site-mod more-mod
                | .
more-mod ::= , site-mod more-mod
           | .
internal-state-mod ::= {(state-name | #) / state-name}
                    | {(state-name)}
                    | .
link-state-mod ::= [(number | . | _ | site-name.agent-name | #) / (number | .)]
                 | link-state
                 | .
counter-state-mod ::= {counter-expression / counter-mod}
                   | {counter-expression}
                   | {counter-mod}
rate ::= algebraic-expression
```

## 2.4 Kappa Declarations

Sections 2.1–2.3 covered the Kappa language in the narrow sense, which is mainly concerned with graph-rewriting. The core language is suited for reasoning formally about static properties of rule-based models. One purpose of the Kappa platform is to enable the simulation of models and the exploration of their dynamic properties.

### 2.4.1 Variables, Algebraic Expressions, and Observables

Many components of KF rely on the declaration of variables. For example, variables might be used as model parameters: If a user redefines the system volume, stochastic rate constants of bimolecular interactions need to scale inversely with the volume.

A variable is declared with the `%var:` directive.

**Grammar 5: Variable declaration**
```
variable-declaration ::= %var: declared-variable-name algebraic-expression
declared-variable-name ::= Label  // not Name
```

### 2.4.2 Agent Signatures

A signature defines the interface of an agent type, i.e., its full complement of sites, including all internal state values that are possible for each site and all potential binding partners.

**Grammar 9: Agent signature**
```
signature-declaration ::= %agent: signature-expression
agent-name ::= Name
site-name ::= Name
state-name ::= Name
signature-expression ::= agent-name(signature-interface)
signature-interface ::= site-name set-of-internal-states set-of-link-states more-signature
                      | site-name set-of-link-states set-of-internal-states more-signature
                      | site-name {= integer / += integer}
more-signature ::= [,] signature-interface
                 | .
set-of-internal-states ::= {set-of-state-names}
                         | .
set-of-state-names ::= state-name . set-of-state-names
                     | .
set-of-link-states ::= [set-of-stubs]
                    | .
set-of-stubs ::= site-name.agent-name . set-of-stubs
                | .
```

### 2.4.3 Initial Conditions

For a model to behave dynamically, a set of agents initially present must be specified. We imagine a pool of agents or complexes that constitute at any given time the state of the system.

**Grammar 10: Initial condition**
```
init-declaration ::= %init: algebraic-expression pattern
                   | %init: algebraic-expression declared-token-name
```

### 2.4.4 Parameters

KaSim has a number of options that can be set on the command line but also from within the KF.

**Grammar 11: Parameters**
```
parameter-setting ::= %def: parameter-name parameter-value
parameter-name ::= reserved names listed in table
parameter-value ::= defined range associated with each parameter-name
```

### 2.4.5 Tokens and Hybrid Rules

At the level of abstraction captured by Kappa, biomolecular processes can span several time and concentration scales. Kappa provides a way of treating such species as pool variables with continuous values. They are called tokens and give rise to "hybrid rules" in which the mechanistic part of the rule is linked to a change in token values.

**Grammar 12: Tokens**
```
token ::= algebraic-expression declared-token-name another-token
another-token ::= , token
                | .
declared-token ::= %token: declared-token-name
declared-token-name ::= Name
```

## 2.5 Intervention Directives

The simulator KaSim executes an event loop whose basic cycle consists of advancing the simulated wall-clock time, selecting a rule for application, and computing updates to reflect the result. It is useful being able to intervene in a simulation by scheduling perturbations, such as injecting a certain number of agents of a given type or modifying a variable, or invoking data reporting tasks.

**Grammar 13: Intervention directives**
```
intervention ::= %mod: (. | alarm float) boolean-expression do effect-list repeat boolean-expression
effect-list ::= effect; effect-list
              | .
effect ::= $ADD algebraic-expression pattern
         | $DEL algebraic-expression pattern
         | $APPLY algebraic-expression rule-expression [| token]
         | $SNAPSHOT string-expression
         | $STOP string-expression
         | $DIN string-expression boolean
         | $TRACK label boolean
         | $UPDATE var-name algebraic-expression
         | $PLOTENTRY
         | $PRINT string-expression > string-expression
         | $SPECIES_OFF string-expression pattern boolean
```

---

# 3. Simulation

In this section we cover some elementary aspects of stochastic simulation as they pertain to rules. This background should help to better understand how Kappa rules work and what happens when a model is simulated by KaSim.

The simulator KaSim is given an input file (a KF), which contains among other things the specification of a model and an initial condition. The initial condition is a collection of molecular species represented in Kappa. A collection of molecular species is called a mixture. In the context of a model, the mixture is the state of the system. The state changes because of events that occur. An event is the reaction induced by the application of a rule to the mixture.

## 3.1 Matching

We refer to a match also as an embedding of a graph, usually an observable or the left pattern of a rule, into a host graph, usually a mixture of molecular species—but it could be any site graph. The term embedding connotes that the host graph must be of equal size or larger than the pattern so that the pattern can "fit" into the host graph.

An embedding or match is formally a subgraph isomorphism: Every node mentioned in the pattern must have a corresponding node of the same type in the host graph; for each node so matched, every site mentioned in its scope must have a corresponding site in the host node and for each site so matched, its state—whether internal or binding—must be the same or be less specific than the one of the host site.

## 3.2 Symmetry

A symmetry of a site graph is an embedding into itself, also called an automorphism. A symmetry, or automorphism, is an isomorphism of a graph to itself, which is a permutation of the identifiers that yields a graph identical to the original even when taking into account the identifiers.

Symmetry awareness is important in Kappa models. For example, we encountered symmetry in section 2.4.1, where we defined the number of embeddings |A(x[1]),A(x[1])| in the mixture for the purpose of counting the instances of homodimers A(x[1]),A(x[1]). Clearly, we don't care about the agent identifiers when counting homodimer objects. However, by virtue of symmetry, the pattern A(x[1]),A(x[1]) has two embeddings in any molecular species A(x[1]),A(x[1]) contained in the mixture. We therefore need to compensate for the symmetry by dividing the number of embeddings by the total number of symmetries, here 2.

## 3.3 Rule Activity

The simulation core loop selects a rule for application to a mixture M with a probability that is proportional to a quantity called the rule activity (or rule propensity). The activity of rule i: Li → Ri @ ki is given by

αi = |{Li ↪ M}| × ki

where {Li ↪ M} is the set of embeddings of Li into M and |·| returns the size of the set; ki is the rate constant. The count |{Li ↪ M}| takes care of mass-action kinetics by reporting the number of opportunities for the rule to apply in M.

### 3.3.1 Symmetry and Rule Activity

Symmetry can affect rule activity in two fundamental ways:

**Stance 1 (ND)**: One stance is to consider only the symmetries of the left pattern L. In this view, the focus is exclusively on the matching of L. The assertion is that two embeddings of L that are related by symmetry constitute the same match; they are equivalent much like a square can be juxtaposed onto another in a number of indistinguishable ways due to its rotational and reflectional symmetry.

**Stance 2 (D)**: The other stance considers the symmetries of the rule, by which we mean the symmetries of the left pattern L that are preserved across the rule arrow and still occur in the right pattern R. Here the focus is not on whether two embeddings of L are indistinguishable, but whether the resulting actions of the rule are indistinguishable.

## 3.4 The Core Loop

The principles of continuous-time Monte-Carlo are well-known and can be found in any number of textbooks. They were laid out for chemical reaction networks by Gillespie in the mid-70s.

A Kappa simulation is largely initialized by the information provided in the KF, which includes a set of rules with rate constants, numbers of agents present initially as well as the specification of their state, observables, and possibly a schedule of intervention directives.

Let T denote the simulated wall-clock time, which is initialized to some value, typically T = 0; let the αi(T), i = 1,...,r be the rule activities as discussed in section 3.3 and let α(T) = Σi αi(T) denote the system activity. The simulation core loop then consists of three conceptual steps:

1. **Time to the next event**: Determine the time interval τ until the next event occurs according to P[next event occurs at τ] = α(T)exp(−α(T)τ)

2. **Type of next event**: Choose which rule induces the next event according to P[rule i fires | next event occurs at τ] = αi(T)/α(T)

3. **Update**: Update the wall-clock time by setting T ← T + τ and update the embeddings for every rule j affected by the altered mixture M(T). Repeat.

## 3.5 The Rate Constant

When using Kappa in a fashion that is informed by basic chemical kinetics, it is useful to be aware of a few basics concerning rate constants.

A rate constant k is the expression of a single mechanism underlying a given type of reaction. It is the probability rate that an event due to that mechanism occurs between time t and t + dt between specific reactants, conditioned by the knowledge that no such event occurred up to t. Such a conditional probability rate is also known as an event "risk".

In a discrete setting, exemplified by the rule 'dim' A(x[.]),B(x[.]) → A(x[1]),B(x[1]) @ k, the risk that a particular A interacts with a particular B depends on the likelihood that they bump into each other, i.e., that the B happens to be in the fraction εV (ε ≪ 1) of system volume V swept out by that A during a time interval dt.

Quite generally, the stochastic rate constant κ associated with a rule must be a volume-scaled version of the rate constant k in the corresponding continuum setting:

κ = k/[s⁻¹ mol^(n-1)] or κ = k/[s⁻¹ molecules^(n-1)]

where n is the molecularity of the interaction, k the deterministic rate constant, V the system volume, and A ≈ 6.022 × 10²³ is Avogadro's number.

---

# 4. Appendices

## A. Syntax of Kappa

### A.1 Names and Labels
```
Name ::= [a-zA-Z][a-zA-Z0-9_~+]*
       | [_][a-zA-Z0-9_~+]+
Label ::= '[^\n']+'
```

### A.2 Pattern Expressions
```
pattern ::= agent more-pattern
agent ::= agent-name(interface)
site ::= site-name internal-state link-state
       | site-name link-state internal-state
       | counter
interface ::= site more-interface
            | .
internal-state ::= {state-name}
                 | {#}
                 | .
link-state ::= [number]
            | [.]
            | [_]
            | [#]
            | [site-name.agent-name]
            | .
```

### A.3 Rule Expressions

#### A.3.1 Chemical Notation
```
f-rule ::= [Label] rule-expression [| token] @ rate
fr-rule ::= [Label] rev-rule-expression [| token] @ rate, rate
ambi-rule ::= [Label] rule-expression [| token] @ rate {rate}
rule-expression ::= (agent | .) more → (agent | .)
rev-rule-expression ::= (agent | .) rev-more (agent | .)
rate ::= algebraic-expression
```

#### A.3.2 Edit Notation
```
f-rule ::= [Label] f-rule-expression [| token] @ rate
f-rule-expression ::= agent-mod more-agent-mod
agent-mod ::= agent-name(interface-mod)
            | agent-name(interface) (+ | −)
site-mod ::= site-name internal-state-mod link-state-mod
internal-state-mod ::= {(state-name | #) / state-name}
link-state-mod ::= [(number | . | _ | site-name.agent-name | #) / (number | .)]
```

## B. Syntax of Declarations

### B.1 Variables, Algebraic Expressions, and Observables
```
variable-declaration ::= %var: declared-variable-name algebraic-expression
algebraic-expression ::= float | defined-constant | declared-variable-name
                       | reserved-variable-name
                       | algebraic-expression binary-op algebraic-expression
                       | unary-op(algebraic-expression)
reserved-variable-name ::= [E] | [E-] | [T] | [Tsim] | declared-token-name
                         | pattern-expression | inf
```

### B.2 Boolean Expressions
```
boolean-expression ::= algebraic-expression (= | < | >) algebraic-expression
                    | boolean-expression || boolean-expression
                    | boolean-expression && boolean-expression
                    | [not] boolean-expression
                    | boolean
boolean ::= [true] | [false]
```

### B.3 Observable Declarations
```
plot-declaration ::= %plot: declared-variable-name
observable-declaration ::= %obs: Label algebraic-expression
```

### B.4 Agent Signature
```
signature-declaration ::= %agent: signature-expression
signature-expression ::= agent-name(signature-interface)
signature-interface ::= site-name set-of-internal-states set-of-link-states more-signature
```

### B.5 Initial Condition
```
init-declaration ::= %init: algebraic-expression pattern
                   | %init: algebraic-expression declared-token-name
```

### B.6 Parameter Settings
```
parameter-setting ::= %def: parameter-name parameter-value
```

### B.7 Token Expressions
```
token ::= algebraic-expression declared-token-name another-token
declared-token ::= %token: declared-token-name
```

### B.8 Intervention Directives
```
intervention ::= %mod: (. | alarm float) boolean-expression do effect-list repeat boolean-expression
effect ::= $ADD algebraic-expression pattern
         | $DEL algebraic-expression pattern
         | $APPLY algebraic-expression rule-expression [| token]
         | $SNAPSHOT string-expression
         | $STOP string-expression
         | $DIN string-expression boolean
         | $TRACK label boolean
         | $UPDATE var-name algebraic-expression
         | $PLOTENTRY
         | $PRINT string-expression > string-expression
         | $SPECIES_OFF string-expression pattern boolean
```

## C. Counters

Counters are a special kind of site that can be used to store bounded non-negative integers and perform some simple tests on them. Importantly, the rate constant of a rule can refer to the counters that appear in it.

**Grammar 14: Counters**
```
counter ::= counter-name {(counter-expression | counter-var | counter-mod)}
counter-name ::= Name
counter-expression ::= (= | >=) integer
counter-var ::= = variable-name
counter-mod ::= (. | +) = integer  // only on the right of a rule
integer ::= i ∈ Z
variable-name ::= Name
```

## D. Continuous-time Monte-Carlo

The basic assumption in modeling stochastic chemical kinetics is that the past does not influence the present. This means that the conditional probability that A(s[.]) and B(s[.]) form a bond during the time interval between t and t + dt, given that no bond was present at t, is independent of t: κdt (where κ is a probability per time unit—a probability rate).

## E. The Symmetries of a Rule

The activity of a rule is defined in terms of the set of embeddings of its left pattern into a mixture. The idea being that an embedding constitutes a candidate physical event. Here we argue that if the action of a rule along two symmetrically related embeddings produces identical mixtures at the level of identifiers (microstate), the two embeddings should be viewed as expressing the same physical event, not distinct events.

---

*This manual provides a comprehensive guide to the Kappa language and its associated tools. For the most up-to-date information and software downloads, visit http://kappalanguage.org.*
