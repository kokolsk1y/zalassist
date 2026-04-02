import adapter from "@sveltejs/adapter-static";

const config = {
	kit: {
		adapter: adapter({
			pages: "build",
			assets: "build",
			fallback: "404.html",
			strict: false
		}),
		paths: {
			base: process.argv.includes("dev") ? "" : "/zalassist"
		},
		appDir: "app"
	}
};

export default config;
