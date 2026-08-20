import { enableScreens } from "react-native-screens";
enableScreens();

import { registerRootComponent } from "expo";
import App from "./src/App.native";

registerRootComponent(App);
