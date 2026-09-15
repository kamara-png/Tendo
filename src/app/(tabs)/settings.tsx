import { Text, View } from "react-native";
import { styles } from "../../styles/styles";

export default function settingsScreen() {
  return (
    <View style={[styles.container, styles.centered]}>
      <Text style={styles.stubText}>Settings</Text>
    </View>
  );
}
