import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import {
  involvingMeFilterLabel,
  transactionSearchFilterLabel,
  type TransactionSearchFilter,
} from "../utils/transactionSearch";

const FILTERS: TransactionSearchFilter[] = ["all", "expenses", "payments", "involving-me"];

export interface TransactionSearchFieldProps {
  query: string;
  onChangeQuery: (value: string) => void;
  filter: TransactionSearchFilter;
  onChangeFilter: (filter: TransactionSearchFilter) => void;
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  scopeNote?: string | null;
  autoFocus?: boolean;
}

/**
 * Rectangular 44pt search field. Filters are a single non-wrapping text line
 * that appears only while the field is open. They are not pills.
 */
export const TransactionSearchField: React.FC<TransactionSearchFieldProps> = ({
  query,
  onChangeQuery,
  filter,
  onChangeFilter,
  open,
  onOpen,
  onCancel,
  scopeNote,
  autoFocus = false,
}) => {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const inputRef = React.useRef<TextInput>(null);
  const involvingLabel = useMemo(
    () => involvingMeFilterLabel(width, fontScale),
    [fontScale, width],
  );

  const cancel = () => {
    inputRef.current?.blur();
    onCancel();
  };

  return (
    <View style={styles.wrap} testID="transaction-search">
      <View style={styles.fieldRow}>
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={onOpen}
          autoFocus={autoFocus}
          placeholder="Search transactions"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          accessibilityLabel="Search transactions"
          testID="transaction-search-input"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[
            styles.field,
            {
              color: theme.colors.onSurface,
              borderColor: open ? theme.colors.outline : theme.colors.outlineVariant,
              backgroundColor: theme.colors.background,
            },
          ]}
        />
        {open ? (
          <Pressable
            onPress={cancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
            testID="transaction-search-cancel"
            style={styles.cancel}
          >
            <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: "600" }}>
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={styles.filters} testID="transaction-search-filters">
          {FILTERS.map((id) => {
            const selected = filter === id;
            const label = transactionSearchFilterLabel(id, involvingLabel);
            return (
              <Pressable
                key={id}
                onPress={() => onChangeFilter(id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                testID={`transaction-search-filter-${id}`}
                style={styles.filterHit}
              >
                <Text
                  numberOfLines={1}
                  variant="labelLarge"
                  style={{
                    color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    fontWeight: selected ? "700" : "400",
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {open && scopeNote ? (
        <Text
          variant="bodySmall"
          testID="transaction-search-scope"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
        >
          {scopeNote}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  field: {
    flex: 1,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  cancel: {
    minHeight: 44,
    justifyContent: "center",
    paddingLeft: 12,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    marginTop: 4,
  },
  filterHit: {
    minHeight: 44,
    justifyContent: "center",
    paddingRight: 14,
    flexShrink: 1,
  },
});
