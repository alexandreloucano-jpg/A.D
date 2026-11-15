# Job Finder — Application Intelligence

Read [INDEX.md](INDEX.md) first. This module adds a 5-step private career application flow without replacing the existing CV Builder, Radar and Studio.

Paths: `/intelligence/offer`, `/intelligence/cv`, `/intelligence/contacts`, `/intelligence/portfolio`, `/intelligence/outreach`.

Source files are installed at build time using `install.cjs --local` for local simulation or a commit-pinned GitHub raw URL for production. The existing CV and fit engine are deliberately reused.

No outbound email or Linkedin operation is performed. Drafts remain in browser localStorage. The public portfolio is a separate website and requires a separate release for selected-case-study filtering.