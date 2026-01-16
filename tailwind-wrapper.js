
const tailwindcss = require('tailwindcss');

// This is a workaround for the unusual environment where the tailwindcss executable is not available.
// We are directly calling the CLI from the tailwindcss library.
require('tailwindcss/lib/cli.js');
