import { Text, View } from "react-native";
import { styles } from "../../styles/styles";

export default function StatisticsScreen() {
  return (
    <View style={[styles.container, styles.centered]}>
      <Text style={styles.stubText}>Stats</Text>
    </View>
  );
}