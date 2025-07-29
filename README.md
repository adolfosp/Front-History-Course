<a id="readme-top"></a> <br />

<div align="center">
  <a href="https://github.com/your-repo-link">
    <img src="https://github.com/user-attachments/assets/41e3ccf5-9779-4cb1-8519-d74af9732c0c" alt="Logo" width="140" height="140">
  </a>

  <h3 align="center">Front-End History Course</h3>

  <p align="center">
    This application will interact with an API to manage and display a course folder structure, enabling users to track their progress by marking courses as completed. 
    <br />
    <a href="https://github.com/your-repo-link"><strong>Explore the docs »</strong></a>
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

* [ ] Fetch course structure from API
* [ ] Display folder structure as a tree view with checkboxes
* [ ] Implement course progress tracking (mark courses as completed)
* [ ] Ensure the UI is responsive
* [ ] Implement basic unit tests

### Future Features

* [ ] Add user authentication for progress tracking per user
* [ ] Add settings for customizing the interface
* [ ] Implement API pagination for large course structures

## Patterns and Technologies

### Technologies:

* **Angular**: Framework for building the front-end application.
* **RxJS**: For managing asynchronous events and data streams.
* **HTML/CSS**: For styling and structuring the front-end layout.

### Design Patterns:

* **Component-based architecture**: The application uses Angular's component system for modularity and reusability.
* **Service layer**: For API interactions and data management.
* **Reactive programming**: Utilizing RxJS for state management and handling asynchronous operations.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Folder structure

```bash
src/
 ├── app/
 │    ├── components/
 │    │    ├── tree-checkbox/
 │    │    ├── tree-table/
 │    ├── domain/
 │    │    ├── interfaces/
 │    │    ├── types/
 │    ├── services/
 │    │    ├── api.service.ts
 │    │    ├── history.service.ts
 │    ├── utils/
 │    │    ├── transformer.ts
 ├── assets/
 ├── rxjs/
 ├── index.ts
 ├── package.json
 └── README.md
```

This structure focuses on separating concerns, with components for UI elements, services for data management, and utilities for helper functions.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This project is under the **APACHE 2** license. For more information, see [LICENSE](/LICENSE).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

* **Linkedin**: [your-linkedin-profile](https://www.linkedin.com/in/your-profile/)
* **Email**: [your-email@example.com](mailto:your-email@example.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
