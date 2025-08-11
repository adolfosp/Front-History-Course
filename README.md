<a id="readme-top"></a> <br />

<div align="center">
  <a href="https://github.com/adolfosp/Front-History-Course">
    <img src="./public/front-history-course.svg" alt="Logo" width="400" height="400">
  </a>

  <h3 align="center">Front-End History Course</h3>

  <p align="center">
    This application will interact with an API to manage and display a course folder structure, enabling users to track their progress by marking courses as completed. 
    <br />
    <a href="https://github.com/adolfosp/Front-History-Course"><strong>Explore the docs »</strong></a>
    <br />
    <br />
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li><a href="#planning-of-versions">Planning of versions</a></li>
    <li><a href="#patterns-and-technologies">Patterns and Technologies</a></li>
    <li><a href="#folder-structure">Folder structure</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About the project

This Angular-based project consumes an API that returns a folder structure containing courses. The user can view this structure and mark which courses have been completed. This project aims to build an intuitive interface for progress tracking through a dynamic tree structure, utilizing checkboxes for marking completed content.

### Key Features:

* Fetch and display the folder structure of courses from the API.
* Visualize the structure in a tree format, with expandable nodes.
* Enable users to mark courses as completed using checkboxes.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Planning of versions

### V1

* [x] Fetch course structure from API
* [x] Display folder structure as a tree view with checkboxes
* [x] Implement course progress tracking (mark courses as completed)
* [ ] Save path folders as json
* [ ] Show popup to confirm do mark all

## Patterns and Technologies

### Technologies:

* **Angular**: Framework for building the front-end application.
* **HTML/CSS**: For styling and structuring the front-end layout.

### Design Patterns:

* **Component-based architecture**: The application uses Angular's component system for modularity and reusability.
* **Service layer**: For API interactions and data management.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Folder structure

```bash
build
dist
electron
public
server
src
└── app
    ├── components
    ├── domain
    ├── rxjs
    ├── services
    ├── tree-table
    ├── utils
    ├── app.config.ts
    ├── app.css
    ├── app.html
    ├── app.routes.ts
    ├── app.spec.ts
    └── app.ts
└── environments
index.html
main.ts
styles.css
.editorconfig
.gitignore
.prettierrc
angular.json
package-lock.json
package.json
README.md
tsconfig.app.json
tsconfig.json
tsconfig.spec.json

```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This project is under the **APACHE 2** license. For more information, see [LICENSE](/LICENSE).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

* **Linkedin**: [Adolfosp](https://www.linkedin.com/in/adolfosp/)
* **Email**: [adolfo.poiatti@gmail.com](mailto:adolfo.poiatti@gmail.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
