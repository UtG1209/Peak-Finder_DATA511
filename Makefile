# Same commands as package.json, for people who prefer make. `make help` lists them.
.PHONY: help setup dev test lint build check validate fake-data doctor

help:      ## show this help
	@grep -E '^[a-z-]+:.*##' Makefile | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'
setup:     ## install app dependencies (npm ci) and enable the commit-msg hook
	git config core.hooksPath .githooks && cd app && npm ci
dev:       ## run the app with hot reload at http://localhost:5173/
	cd app && npm run dev
test:      ## models, URL state and the data contract
	cd app && npm test
lint:      ## eslint
	cd app && npm run lint
build:     ## production build (includes the 3D walks)
	cd app && npm run build
check:     ## everything CI runs: CLAUDE.md check, lint, test, build without walks, budget
	node scripts/check-claude-md.mjs && cd app && npm run lint && npm test && SKIP_WALKS=1 npm run build && cd .. && node scripts/check-budget.mjs
validate:  ## check app/public/data against the data contract
	cd app && npm run validate:data
fake-data: ## regenerate the placeholder data (deterministic)
	python3 scripts/make_fake_data.py
doctor:    ## check your machine has what the repo needs
	bash scripts/doctor.sh
