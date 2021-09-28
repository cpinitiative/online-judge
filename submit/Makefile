build-SubmitFunction:
	cp -r src "$(ARTIFACTS_DIR)/"
	cp package.json package-lock.json tsconfig.json tsconfig.build.json "$(ARTIFACTS_DIR)/"
	npm install --prefix "$(ARTIFACTS_DIR)/"
	npm run --prefix "$(ARTIFACTS_DIR)/" build