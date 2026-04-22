# Find Skills

Discover and install specialized agent skills from the open ecosystem when users need extended capabilities.

## Summary

Helps identify relevant skills by domain and task when users ask "how do I do X" or "find a skill for X". Integrates with the Skills CLI (`npx skills find`, `npx skills add`) to search, verify, and install packages from the skills.sh directory.

## Installation

```bash
$ npx skills add https://github.com/vercel-labs/skills --skill find-skills
```

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows
- Mentions they wish they had help with a specific domain (design, testing, deployment, etc.)

## What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem. Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools.

Key commands:

- `npx skills find [query]` - Search for skills interactively or by keyword
- `npx skills add <package>` - Install a skill from GitHub or other sources
- `npx skills check` - Check for skill updates
- `npx skills update` - Update all installed skills

Browse skills at: https://skills.sh/

## How to Help Users Find Skills

### Step 1: Understand What They Need

Identify the domain (e.g., React, testing, design, deployment) and the specific task (e.g., writing tests, creating animations, reviewing PRs).

### Step 2: Check the Leaderboard First

Check the [skills.sh leaderboard](https://skills.sh/) to see if a well-known skill already exists. Top skills include:

- `vercel-labs/agent-skills` — React, Next.js, web design
- `anthropics/skills` — Frontend design, document processing

### Step 3: Search for Skills

Run the find command:

```bash
npx skills find [query]
```

### Step 4: Verify Quality Before Recommending

- **Install count**: Prefer 1K+ installs. Be cautious with <100.
- **Source reputation**: Official sources (`vercel-labs`, `anthropics`, `microsoft`) are more trustworthy.
- **GitHub stars**: Check the source repository.

### Step 5: Present Options to the User

Present the skill name, description, install count, source, and install command.

Example:

> I found a skill that might help! The "react-best-practices" skill provides React and Next.js performance optimization guidelines from Vercel Engineering (185K installs).
>
> To install it:
> `npx skills add vercel-labs/agent-skills@react-best-practices`

### Step 6: Offer to Install

If the user wants to proceed:

```bash
npx skills add <owner/repo@skill> -g -y
```

## Common Skill Categories

| Category        | Example Queries                          |
| :-------------- | :--------------------------------------- |
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing         | testing, jest, playwright, e2e           |
| DevOps          | deploy, docker, kubernetes, ci-cd        |
| Documentation   | docs, readme, changelog, api-docs        |
| Code Quality    | review, lint, refactor, best-practices   |
| Design          | ui, ux, design-system, accessibility     |
| Productivity    | workflow, automation, git                |

## Tips for Effective Searches

- Use specific keywords: "react testing" is better than "testing".
- Try alternative terms: "deploy" vs "deployment" or "ci-cd".
- Check popular sources: `vercel-labs/agent-skills`.

## When No Skills Are Found

Acknowledge no skill was found and offer to help directly. Suggest creating a new skill with `npx skills init`.
