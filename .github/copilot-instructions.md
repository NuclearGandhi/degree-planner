# Degree Planner Application Instructions

## Overview
This is a React-based degree planner application that helps students plan their academic path by visualizing courses and prerequisites. The app uses ReactFlow (via @xyflow/react) for visualizing the course plan.

## Key Features
1. **Right-to-Left Flow**: Displays course semesters as columns of nodes from right (first semester) to left (last semester)
2. **Dark/Light Theme Toggle**: Users can switch between dark and light modes
3. **Degree Templates**: Currently supports Mechanical Engineering with more planned
4. **Course Management**: Add/remove courses to semesters with prerequisite visualization
5. **Grade Tracking**: Record grades for each course to calculate semester and overall averages
6. **Responsive Design**: Works on multiple screen sizes
7. **Custom Set of Rules**: Create a custom set of rules from the degree template, or start from a fresh clean one.

## Technical Details
- Built with React 19 and TypeScript, and Vite
- Uses @xyflow/react (ReactFlow v12) for flow visualization. Notice the @xyflow/react already has dark/light support using 'colorMode'. Look at `https://reactflow.dev/learn/troubleshooting/migrate-to-v12` for more instructions about what changed in v12. 
- Tailwind CSS for styling. Use `npm install tailwindcss @tailwindcss/vite` to install it, since we are using Vite. Since we want to use tailwind v4, we don't need to use `npx tailwindcss init -p` anymore. Look at `https://tailwindcss.com/docs/upgrade-guide` for more instructions about what changed in v4.
- Fetches course data from the Technion SAP info fetcher.
- The app is in Hebrew.
- Doesn't have a Header, instead, the Logo will be shown as floating on the ReactView
- The rules should appear as nodes on the main ReactFlow, above the semesters.
- Each column will have at its end another dashed node for 'add course', which is a button to add a course from the course list.
- If the user has inputed 5 semesters lets say, to the left of it should be another big box that says 'add another semester', with a max of 16 semesters.
- Each course that is added, is counted into the set of rules (like, 1 out of 2 courses in List A, or 130 course points out of 157.5).
- Once a template has been selected, fill the main react flow with only the mandatory courses.
- Have an option to save up to 3 different degrees - each with its own set of rules and courses
- The name of the app is 'DegreePlanner'. The icons are in `public/assets`.

## Data Structure
1. **Course Data**: Sourced from `public/data/merged_courses.json`
   - Each course has an ID, name, prerequisites, and available semesters
   - Prerequisites are stored as a logical tree with 'and'/'or' conditions

2. **Degree Templates**: Defined in `public/data/degrees.json`
   - Contains semester-by-semester course plans for each degree
   - Currently only has Mechanical Engineering
   - Only a template - contains the basic set of rules for a degree.
   - The courses in 'semesters' are mandatory. The courses in 'courses-lists' are considered 'selective'.

3. **Data Updates**: The `scripts/update_semesters.py` script fetches the latest course data

## Future Improvements
1. Add more degree templates (Electrical Engineering, Computer Science, etc.)
2. Implement authentication and cloud saving via Google accounts
4. Implement rule editor for customizing degree requirements
5. Add printable/exportable reports