# ADR-0004: Every issue has one owner and any number of assignees
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator) · Informed by: deck slide 7
Supersedes: — · Superseded by: —

## Context
Agents can do work but can’t be held responsible for outcomes. Trackers with only an assignee lose accountability when an agent picks up an issue.

## Decision
We will give every issue exactly one owner, who is always a person and is inherited from the nearest ancestor unless set, and any number of assignees, who can be people or agents.

## Consequences
- Good: questions, escalations, and outcome acceptance always reach a person; agents can be assigned freely; review splits cleanly into code review and outcome acceptance.
- Bad: one more concept to learn. Inheritance can hide who owns an issue unless the UI shows it clearly, as the faded “from CHK-12” treatment does.
- Neutral: validation rules: an issue can’t move to To do without a resolved owner, Autopilot needs a person as owner, and an owner can’t be removed while agents are working.

## Revisit triggers
- Teams routinely override inherited owners on most sub-issues, which would suggest inheritance is the wrong default.
