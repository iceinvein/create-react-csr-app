#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');

const userAnswers = {
  projectName: '',
  styling: 'none',
  linting: 'none',
  router: 'none',
  reactQuery: 'no'
};

const devDependencies = [];
const dependencies = [];

const tailwindVersion = "3.4.17"

program
  .name('create-react-csp-app')
  .description('Create a new React project with TypeScript, ESLint, and Prettier')
  .argument('[project-directory]', 'Project directory name')
  .action(async (projectDirectory) => {
    try {
      const prompts = [];
      if (!projectDirectory) {
        prompts.push({
          type: 'input',
          name: 'projectName',
          message: 'What is your project name?',
          validate: (input) => {
            if (/^[A-Za-z\d\s\-\_]+$/.test(input)) return true;
            return 'Project name may only include letters, numbers, spaces, underscores and hashes.';
          },
          filter: (input) => input.replace(/\s+/g, '-'),
        });
      }

      prompts.push({
        type: 'list',
        name: 'styling',
        message: 'Which styling solution would you like to use?',
        choices: [
          { name: 'Material-UI (MUI)', value: 'mui' },
          { name: 'Tailwind CSS', value: 'tailwind' },
          { name: 'None', value: 'none' }
        ]
      });

      prompts.push({
        type: 'list',
        name: 'linting',
        message: 'Which linting solution would you like to use?',
        choices: [
          { name: 'ESLint + Prettier', value: 'eslintPrettier' },
          { name: 'BiomeJS', value: 'biome' },
          { name: 'None', value: 'none' }
        ]
      });

      prompts.push({
        type: 'list',
        name: 'router',
        message: 'Which routing library would you like to use?',
        choices: [
          { name: 'None', value: 'none' },
          { name: 'React Router', value: 'reactRouter' },
          { name: 'TanStack Router', value: 'tanStackRouter' },
        ]
      });

      prompts.push({
        type: 'list',
        name: 'reactQuery',
        message: 'Would you like to use React Query?',
        choices: [
          { name: 'No', value: 'no' },
          { name: 'Yes', value: 'yes' },
        ]
      });

      const answers = await inquirer.prompt(prompts);

      userAnswers.projectName = answers.projectName ?? projectDirectory;
      userAnswers.styling = answers.styling;
      userAnswers.linting = answers.linting;
      userAnswers.router = answers.router;
      userAnswers.reactQuery = answers.reactQuery;

      const projectPath = path.resolve(userAnswers.projectName);
      
      console.log(chalk.blue(`Creating a new React CSR app in ${projectPath}`));

      // Create project directory
      fs.ensureDirSync(projectPath);

      // Initialize project with Vite and React template
      execSync(`npm create vite@latest ${userAnswers.projectName} -- --template react-swc-ts`, { stdio: 'ignore' });

      // Change to project directory
      process.chdir(projectPath);

      // Add styling dependencies based on selection
      if (userAnswers.styling === 'mui') {
        dependencies.push('@mui/material', '@emotion/react', '@emotion/styled', '@mui/icons-material');
      } else if (userAnswers.styling === 'tailwind') {
        devDependencies.push(`tailwindcss@${tailwindVersion}`, 'postcss', 'autoprefixer');
      }

      // Add linting dependencies based on selection
      if (userAnswers.linting === 'eslintPrettier') {
        devDependencies.push('eslint', 'prettier', 'eslint-config-prettier', 'eslint-plugin-prettier', 'eslint-plugin-react', 'eslint-plugin-react-hooks');
        fs.writeFileSync('.prettierrc', JSON.stringify({
          "semi": true,
          "trailingComma": "es5",
          "singleQuote": true,
          "printWidth": 100,
          "tabWidth": 2
        }, null, 2));
      } else if (userAnswers.linting === 'biome') {
        devDependencies.push('@biomejs/biome');
        fs.unlinkSync('eslint.config.js');
      }

      if (devDependencies.length > 0) {
        console.log(chalk.blue('\nInstalling development dependencies...'));
        execSync(`npm install --save-dev ${devDependencies.join(' ')}`, { stdio: 'ignore' });
      }

      if (dependencies.length > 0) {
        console.log(chalk.blue('\nInstalling dependencies...'));
        execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'ignore' });
      }

      if (userAnswers.styling === 'tailwind') {
        execSync('npx tailwindcss init -p', { stdio: 'ignore' });
        
        // Configure Tailwind CSS
        fs.writeFileSync('tailwind.config.js', `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`);
        
        // Update index.css with Tailwind directives
        fs.writeFileSync('src/index.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;');
      }

      // Initialize biome
      if (userAnswers.linting === 'biome') {
        execSync('npx biome init', { stdio: 'ignore' });
      }

      // Add scripts to package.json
      const packageJson = require(path.join(process.cwd(), 'package.json'));
      const scripts = (() => {
        if (userAnswers.linting === 'eslintPrettier') {
          return {
            ...packageJson.scripts,
            "lint": "eslint src --ext .ts,.tsx",
            "lint:fix": "eslint src --ext .ts,.tsx --fix",
            "format": "prettier --write 'src/**/*.{ts,tsx,css,md}'"
          }
        }
        if (userAnswers.linting === 'biome') {
          return {
            ...packageJson.scripts,
            "lint": "biome check --apply src",
            "lint:fix": "biome check --apply --fix src"
          }
        }

        return Object.fromEntries(
          Object.entries(packageJson.scripts).filter(([key]) => !['lint', 'lint:fix', 'format'].includes(key))
        );
      })();
      packageJson.scripts = scripts;      
      fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

      console.log(chalk.green('\nSuccess! Created', userAnswers.projectName, 'at', projectPath));
      console.log(chalk.blue('\nInside that directory, you can run several commands:'));
      console.log(chalk.cyan('\n  npm run dev'));
      console.log('    Starts the development server.');
      console.log(chalk.cyan('\n  npm run build'));
      console.log('    Bundles the app into static files for production.');
      console.log(chalk.cyan('  npm run dev'));
      console.log(chalk.blue('\nGo build your Billion dollar app now!'));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse();