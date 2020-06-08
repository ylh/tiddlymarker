tiddlymarker.xpi:
	zip -r -FS tiddlymarker.xpi manifest.json *.js *.html *.css _locales icons
clean:
	rm tiddlymarker.xpi
