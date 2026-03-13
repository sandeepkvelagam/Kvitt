# Kvitt Mobile Design System & Apple‑Grade UI Architecture

## Purpose
This document is the **single execution blueprint** for implementing a production‑grade mobile design system for Kvitt.

It combines:

• The Kvitt design system rules
• Apple Human Interface Guidelines principles
• Enterprise mobile UI patterns used by Fortune 500 apps
• A structured implementation plan for Claude

The goal is to eliminate UI inconsistency and create **one stable, semantic, reusable mobile UI system**.

This system must be:

• consistent
• cognitively simple
• thumb friendly
• visually premium
• accessible
• easy to scan
• easy to maintain in code

This document is the **authoritative specification** Claude must follow when building and refactoring the mobile UI.

---

# 1. Core Product Philosophy

Kvitt should feel like a **modern premium fintech product**.

Design tone should feel similar to:

• Apple
• Stripe
• Linear
• Notion
• Uber

Characteristics:

• clean
• calm
• structured
• consistent
• high readability
• minimal cognitive load

Avoid:

• random colors
• random sizes
• random card styles
• visual clutter

Premium apps look simple because they are **systematically designed**.

---

# 2. Apple Human Interface Principles

Kvitt mobile UI must follow Apple‑style usability rules.

## 2.1 Minimum Touch Targets

Apple guideline:

Minimum interactive control size:

44 × 44 points

Implementation rule:

Never allow:

• buttons < 44 height
• icon tap areas < 44
• row heights < 44

Even if icon size is smaller.

Example:

Icon size = 24
Touch area = 44

Padding must increase tap region.

---

## 2.2 Text Legibility

Apple guideline:

Minimum readable text ≈ 11 pt

Kvitt rule:

Smallest text token = **11**

Never allow:

9
10

---

## 2.3 Cognitive Clarity

Apple emphasizes:

• clarity
• hierarchy
• simplicity

Users should understand a screen within **3 seconds**.

Every screen must clearly communicate:

1 What page this is
2 What information matters
3 What action user should take

---

## 2.4 Alignment & Layout

Apple guideline:

Align elements to show relationships.

Kvitt rule:

Avoid random placements.

Content must follow predictable structure.

---

## 2.5 Image Quality

Images must support:

@2x
@3x

Never stretch images.

Always maintain aspect ratio.

---

# 3. Kvitt Brand Color System

Dashboard V2 established the brand direction.

Two core colors:

Dark Orange
Blue

## Color Hierarchy

Primary Action

Dark Orange

Used for:

• main CTA buttons
• high importance actions
• selected states

Secondary Accent

Blue

Used for:

• secondary actions
• informational emphasis
• links

Neutral Surface

Glass / neutral

Used for:

• cards
• background surfaces

Rule:

Never mix orange and blue as competing CTAs in the same area.

Only one primary action should dominate.

---

# 4. Apple‑Style Layout Framework

Every Kvitt screen must follow this **layout hierarchy model**.

This dramatically improves usability.

## Layer 1 — Screen Identity

Top of screen.

Contains:

• page title
• summary info
• key status or balance

Users immediately understand where they are.

---

## Layer 2 — Primary Content

Middle section.

Contains:

• main list
• cards
• data

This is the **core interaction area**.

---

## Layer 3 — Primary Action

Should be visually obvious.

Placement options:

• sticky bottom CTA
• floating action
• prominent card action

Primary actions must be easy to reach with thumb.

---

## Layer 4 — Secondary Controls

Contains:

• filters
• settings
• low priority actions

These should not compete visually with primary actions.

---

# 5. Typography System

Never use arbitrary font sizes in screens.

All text must use **semantic roles**.

## Approved Typography Tokens

screenTitle

24 / 700

Use:

• major screen headers

---

navTitle

17 / 600

Use:

• navigation bars

---

cardTitle

18 / 600

Use:

• card headers
• modal titles

---

body

16 / 400

Use:

• main readable content

---

bodyStrong

16 / 600

Use:

• emphasized labels

---

secondary

14 / 400

Use:

• supporting text

---

sectionLabel

12 / 600

Use:

• section headers

---

meta

12 / 500

Use:

• metadata
• timestamps

---

micro

11 / 500

Use:

• badges

---

### Typography Rules

Remove these values entirely:

9
10
13
15
17
20
22

Unless mapped to semantic tokens.

---

# 6. Spacing System

One spacing scale only.

Approved values:

4
8
12
16
20
24
32

## Semantic Spacing

4
micro adjustment

8
tight spacing

12
compact control padding

16
standard padding

20
screen horizontal padding

24
section spacing

32
major layout spacing

Never use:

14
18
22

---

# 7. Radius System

Reduce radius noise.

Approved radius values:

8
12
16
24
full

Remove:

14
18
20
28
32

Unless explicit exception.

---

# 8. Component Size Rules

## Buttons

Allowed heights:

44
52

Optional hero CTA:

56

---

## Inputs

44
52

---

## Icon Buttons

Minimum tap area:

44

---

## Avatars

24
32
40
56
72

---

# 9. Button Hierarchy

Primary

Orange

Main action

---

Secondary

Blue accent

Supporting action

---

Tertiary

Neutral / text

Low emphasis

---

Destructive

Red semantic

Use sparingly

---

# 10. Cognitive Simplicity Test

Every screen must pass.

Ask:

Can user understand purpose in 3 seconds?

Is the main action obvious?

Are there too many colors?

Are there too many card styles?

Are sections easy to scan?

If not — simplify.

---

# 11. Engineering Rules

These must be enforced in code.

## One Token Source

Create a single token file.

Remove duplicate systems.

---

## Semantic Components

Build reusable primitives:

Text
Button
Input
Surface
PageHeader
SectionHeader
ListItem

---

## No Raw Styling

Avoid in screens:

fontSize: 15
padding: 18
radius: 14

Always reference tokens.

---

# 12. Component Variant System

Components must expose **limited variants**.

Example:

Text

variants:

screenTitle
navTitle
cardTitle
body
secondary
meta
micro

---

Button

variants:

primary
secondary
tertiary
destructive

sizes:

compact
regular

---

# 13. Implementation Phases

Claude must execute in phases.

## Phase 1

Foundation

• audit tokens
• create unified token system

---

## Phase 2

Core components

Create primitives:

Text
Button
Input
Surface

---

## Phase 3

Navigation patterns

Standardize:

headers
section headers
drawer

---

## Phase 4

Screen migration

Order:

Dashboard
Groups
Chats
PendingRequests
Profile
Settings
Notifications

---

# 14. QA Validation

Check:

• touch targets ≥ 44
• token usage only
• button color hierarchy
• typography consistency
• spacing rhythm
• visual hierarchy

---

# 15. Final Instruction for Claude

Your role is to implement a **production mobile design system**.

You must:

1 Analyze current code

2 Compare against this document

3 Identify gaps

4 Propose token system

5 Propose component architecture

6 Produce migration tasks

7 Implement safely in phases

Never introduce arbitrary values.

Never create new inconsistent variants.

Ensure UI remains visually premium.

---

# Final Success Criteria

Kvitt UI should feel like:

One product

Not a collection of screens.

Users should experience:

• clear hierarchy
• easy navigation
• easy actions
• consistent design

Engineering should benefit from:

• reusable components
• token enforcement
• maintainable codebase

This document is the **authoritative blueprint** for the Kvitt mobile design system rollout.

