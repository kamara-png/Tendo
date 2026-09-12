import { StyleSheet } from "react-native";
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 30,
    fontWeight: "900",
  },
  iconButton: {
    padding: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#33373d",
  },
  habitName: {
    color: "white",
    fontSize: 16,
    flex: 1,
    marginLeft: 12,
  },
  text: {
    color: "white",
  },
});

export const sizes = {
  icon: 24,
};
