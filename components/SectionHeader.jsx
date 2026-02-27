import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { selectSelectedIdsSet, selectAll, deselectAll } from '../store/gallerySlice';

export default function SectionHeader({ title, assetIds }) {
  const dispatch = useDispatch();
  const selectedIds = useSelector(selectSelectedIdsSet);

  const allSelected =
    assetIds.length > 0 && assetIds.every((id) => selectedIds.has(id));

  const handleToggle = () => {
    if (allSelected) {
      dispatch(deselectAll(assetIds));
    } else {
      dispatch(selectAll(assetIds));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity onPress={handleToggle} style={styles.button}>
        <Text style={styles.buttonText}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  buttonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
});
