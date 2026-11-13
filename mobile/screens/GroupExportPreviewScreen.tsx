import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Appbar, Menu, useTheme } from "react-native-paper";
import { GroupExportSheet } from "../components/GroupExportSheet";
import { useThemePreference } from "../contexts/ThemePreferenceContext";

export type GroupExportShot = "menu" | "choice";

export function readGroupExportShot(url: string | null | undefined): GroupExportShot {
  if (!url) return "menu";
  const match = /[?&#]shot=([a-z0-9-]+)/i.exec(url);
  return match?.[1]?.toLowerCase() === "choice" ? "choice" : "menu";
}

/** Dev-only frames for the group export entry and the CSV / PDF choice. */
export function GroupExportPreviewScreen({ shot }: { shot: GroupExportShot }) {
  const theme = useTheme();
  const { setThemePreference } = useThemePreference();
  const showChoice = shot === "choice";

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const dark = /[?&#]theme=dark/i.test(window.location.href);
    void setThemePreference(dark ? "dark" : "light");
  }, [setThemePreference]);
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction accessibilityLabel="Navigate back" />
        <Appbar.Content title="Flat 4B" titleStyle={{ fontWeight: "bold" }} />
        <Menu
          visible={!showChoice}
          onDismiss={() => undefined}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              accessibilityLabel="Group options"
              testID="group-menu-button"
            />
          }
          contentStyle={{ minWidth: 200 }}
        >
          <Menu.Item title="History" leadingIcon="history" testID="group-menu-history" />
          <Menu.Item title="Export" leadingIcon="download" testID="group-menu-export" />
          <Menu.Item title="Share summary" leadingIcon="share-variant" testID="group-menu-share-summary" />
          <Menu.Item title="People" leadingIcon="account-group" testID="group-menu-people" />
          <Menu.Item title="Spending & stats" leadingIcon="chart-pie" testID="group-menu-spending" />
          <Menu.Item title="Rates" leadingIcon="percent" testID="group-menu-rates" />
          <Menu.Item title="Edit group details" leadingIcon="pencil" testID="group-menu-edit-details" />
          <Menu.Item title="Default split" leadingIcon="scale-balance" testID="group-menu-default-split" />
          <Menu.Item title="Settlement currency" leadingIcon="cash-sync" testID="group-menu-settlement-currency" />
          <Menu.Item title="Import from Splitwise" leadingIcon="file-import-outline" testID="group-menu-import-splitwise" />
          <Menu.Item title="Archive" leadingIcon="archive-outline" testID="group-menu-archive" />
          <Menu.Item
            title="Leave group"
            leadingIcon="exit-run"
            titleStyle={{ color: theme.colors.error }}
            testID="group-menu-leave"
          />
        </Menu>
      </Appbar.Header>
      <GroupExportSheet
        visible={showChoice}
        pdfAvailable
        busy={null}
        onDismiss={() => undefined}
        onExport={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
