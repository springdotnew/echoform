[![fullstack](./assets/Logo.png)](#)

<p align="center">
  A React framework for building React applications with server-side executing
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@playfast/echoform"><img alt="NPM Version" src="https://img.shields.io/npm/v/@playfast/echoform?style=for-the-badge"></a>
  <a href="https://www.npmjs.com/package/@playfast/echoform"><img alt="NPM Downloads" src="https://img.shields.io/npm/dt/@playfast/echoform?style=for-the-badge"></a>
</p>

echoform is a react framework for building React applications with their layout/UI components running on the client and with the connections between them and business logic running on the server.


## Server-side executing and not rendering
"echoform" is the exact opposite of server-side-rendering in "echoform" instead of rendering your app in the server and running it in the client you actually render the app in the client ( plus manage user UI logic ) and run it ( manage the app business-logic ) in the server.   
for example, user UI interactions will run on the client while logic related stuff like layout changes and data fetching will run on the server

## All the benefits of React now in your server :)
using React in your server will make it much less static and much more reactive a lot like the move in the client from JQuery like libraries to web frameworks like React or Vue.   
React components will make your code much more reusable plus stuff like the [React context API](https://reactjs.org/docs/context.html) will make your code data flow much more organized. and the most important part of using React in your server - you could use the entire collection of React libraries ( at least the non-dom related part of them :} ) in your server!!!

## Speed advantages and limits over regular React apps
"echoform" can even have some speed advantages compare to regular React applications because pages do not need to fetch data using HTTP every load.  
the regular data flow goes something like that  
`user action` -> `layout-change` -> `new component data HTTP fetching` -> `layout-update`  
now with "echoform" the data flow should look more like that  
`user client action` -> `server socket action request` -> `server tells the client via socket to update itself with new data`  
in cases where a new data is needed to update the view layout the "echoform" way of updating the layout should be much faster but in places where a layout change occurs with no new data "echoform" can actually be slower

## Use cases
I recently moved a project of mine called ["web-desktop-environment"](https://github.com/shmuelhizmi/web-desktop-environment) to "echoform".  
["web-desktop-environment"](https://github.com/shmuelhizmi/web-desktop-environment) was a great example of a project that really benefited a lot from using "echoform" since he needs a tight connection between the server and the client and apart from that moving his entire server logic to react components made the server codebase much more user-readable and organized.

# Getting Started - TypeScript

a "echoform" app is usually made up of three different packages

- a server package - for the server
- a client package - for the client react app
- a shared package - for sharing the views component types use in both the server and client

we are going to start by creating a shared package for declaring all of our layout client components that the server is going to tell the client to render

Example:

```ts
// shared/src/index.ts

import { View } from "@playfast/echoform/shared";

export const Views = {
  Home: {} as View<{ username: string; logout: () => void }>, // Home layout component and its props
  Login: {} as View<{ login: (username: string, password: string) => void }>, // Login layout component and its props
  Prompt: {} as View<{ message: string; onOk: () => void }>, // Prompt layout component and its props
  Gif: {} as View<{ url: string }>, // a Gif component and its props
};
```

next, after we finished declaring all of our client components in our shared package we are going to move on to the server

```tsx
// server/src/index
import React from "react";
import { Render } from "@playfast/echoform-render";
import { ViewsProvider } from "@playfast/echoform/server";
import { Views } from "shared-package"; // import our shared package
import { Server } from "@playfast/echoform-socket-server";


const App = () => {
  const [location, setLocation] = useState<"home" | "error" | "login">("login"); // example state for the current layout
  const [name, setName] = useState(""); // exampke state for the user name
  return (
    <ViewsProvider<typeof Views>>
      {" "}
      {/* View Provider that provide as with all of our shared views  */}
      {({ Home, Login, Prompt, Gif }) => {
        return (
          <>
            {location === "login" && ( // log in view
              <Login
                login={(username, password) => {
                  if (password === "0000") {
                    // the secret password is 0000 if the user give it to us log him in
                    setName(username);
                    setLocation("home");
                  } else {
                    setLocation("error");
                  }
                }}
              />
            )}
            {location === "home" && ( // home view
              <Home
                logout={() => setLocation("login") /* log out of the account */}
                username={name}
              >
                <Gif url="url_to_gif.gif" />
              </Home>
            )}
            {location === "error" && ( // error prompt view in case of a worong password
              <Prompt
                message={"worng password"}
                onOk={() => setLocation("login")}
              />
            )}
          </>
        );
      }}
    </ViewsProvider>
  );
};

Render(
  // run the server on port 8485
  <Server port={8485} views={Views}>
    {() => <App /> /* on each connection to the server create an app */}
  </Server>
);
```

after we finished adding all of our business logic to the server its now time to create some views

```tsx
// client/src/index

import React from "react";
import ReactDOM from "react-dom";
import { Component } from "@playfast/echoform/client";
import { Client } from "@playfast/echoform-socket-client"
import { Views } from "shared-package";

// home layout component
class Home extends Component<typeof Views["Home"]> {
  render() {
    return (
      <div>
        <h1>Hello - {this.props.username}</h1>
        {this.props.children}
        <button onClick={() => this.props.logout()}>logout</button>
      </div>
    );
  }
}

// prompt layout component
class Prompt extends Component<typeof Views["Prompt"]> {
  render() {
    return (
      <div>
        <h1>{this.props.message}</h1>
        {this.props.children}
        <button onClick={() => this.props.onOk()}>ok</button>
      </div>
    );
  }
}

// login layout component
class Login extends Component<
  typeof Views["Login"],
  { username: string; password: string }
> {
  render() {
    return (
      <div>
        <input
          type="text"
          onChange={(e) => this.setState({ username: e.target.value })}
          placeholder="username"
        />
        <input
          type="text"
          onChange={(e) => this.setState({ password: e.target.value })}
          placeholder="password"
        />
        <button
          onClick={() =>
            this.props.login(this.state.username, this.state.password)
          }
        >
          LogIn
        </button>
      </div>
    );
  }
}

// gif component
class Gif extends Component<typeof Views["Gif"]> {
  render() {
    return (
      <div>
        <img src={this.props.url} />
      </div>
    );
  }
}

ReactDOM.render(
  // connect to our server running on localhost:8485
  <Client<typeof Views>
    host="localhost"
    port={8485}
    views={{ Home, Login, Prompt, Gif }}
  />,
  document.getElementById("root")
);
```

and we are now finished you should now have a react application the can run on a server : )
