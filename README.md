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
    <li><a href="#instalação-e-execução">Instalação e execução</a></li>
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
* [x] Text getting out of box
* [x] Save path folders as json
* [x] Add semantic
* [x] Show popup to confirm do mark all
* [x] When click on close, save the progress
* [x] Fetch course structure from API
* [x] Display folder structure as a tree view with checkboxes
* [x] Implement course progress tracking (mark courses as completed)
* [x] Mark the video as completed automatically when the user watches it in full
* [x] Add the time that the video stopped 

### V2
* [x] Show how many times the video has
* [x] Add option to reset the progress of video
* [x] Light-Dark Theme
* [x] Automaticaly reproduction
* [x] Add the date that finished watching the video
* [x] Add option to load image as banner automatically
* [x] Show the progress in percentage
* [x] When watched 95% of the video, mark as completed

## Patterns and Technologies

### Technologies:

* **Angular**: Framework for building the front-end application.
* **Electron**: Desktop application runtime.
* **Express**: API used to read courses, stream videos, and save progress.
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

## Instalação e execução

### Pré-requisitos

* Node.js e npm.
* Google Chrome para executar ou depurar a versão web pelo VS Code.

### Instalar as dependências

O front-end e o servidor possuem dependências separadas. Na raiz do projeto, execute:

```bash
npm install
npm --prefix server install
```

### Executar no navegador

O comando abaixo inicia o Angular em `http://localhost:4200` e o servidor de desenvolvimento em `http://localhost:4057`:

```bash
npm run start-all:dev
```

### Executar Electron e servidor pelo terminal

O Electron carrega o build de produção do Angular, que utiliza a API em `http://localhost:4047`. Inicie o servidor no primeiro terminal:

```bash
npm --prefix server run start:prod
```

Em outro terminal, gere o front-end e inicie o Electron:

```bash
npm run build
npm run electron
```

### Executar pelo VS Code

Abra **Run and Debug** (`Ctrl+Shift+D`) e escolha uma das configurações:

* **Electron + Servidor**: gera o front-end e inicia juntos o Electron e a API na porta `4047`.
* **Electron**: gera e inicia apenas o aplicativo desktop; use esta opção se a API já estiver em execução.
* **Servidor da API (Electron)**: inicia apenas a API compatível com o build do Electron.
* **Angular + Servidor (desenvolvimento)**: inicia o Angular no navegador e a API de desenvolvimento.
* **Testes Angular**: inicia o runner de testes no Chrome.

Ao encerrar a configuração composta **Electron + Servidor**, o VS Code também encerra os dois processos.

### Gerar o instalador

Para gerar o instalador do Windows, execute:

```bash
npm run dist
```

O arquivo gerado estará na pasta `/release`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This project is under the **APACHE 2** license. For more information, see [LICENSE](/LICENSE).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

* **Linkedin**: [Adolfosp](https://www.linkedin.com/in/adolfosp/)
* **Email**: [adolfo.poiatti@gmail.com](mailto:adolfo.poiatti@gmail.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
