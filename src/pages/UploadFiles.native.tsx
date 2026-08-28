import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  NativeCard,
  NativeCardContent,
  NativeBadge,
  SafeAreaView,
} from "@/components/native";
import {
  Modal,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { uploadArchiveService } from "@/services/uploadArchiveService";
import type { ArchivedUpload, UploadType } from "@/types/uploadArchive";

const PAGE_SIZE = 50;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function UploadFiles() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState<ArchivedUpload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Fetch list of files
  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["uploadArchive-native", selectedType],
    queryFn: () => uploadArchiveService.list(selectedType === "all" ? undefined : (selectedType as UploadType)),
  });

  const files = data?.files ?? [];
  const uploadTypes = data?.upload_types ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => uploadArchiveService.remove(id),
    onSuccess: () => {
      Alert.alert("Success", "File removed from archive.");
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive-native"] });
      setSelectedFile(null);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to remove file.");
    },
  });

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => uploadArchiveService.remove(id))),
    onSuccess: () => {
      Alert.alert("Success", `${selectedRows.size} files removed from archive.`);
      void queryClient.invalidateQueries({ queryKey: ["uploadArchive-native"] });
      setSelectedRows(new Set());
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to remove files.");
    },
  });

  const handleDeletePress = (file: ArchivedUpload) => {
    Alert.alert("Confirm Delete", `Are you sure you want to delete ${file.filename}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(file.id),
      },
    ]);
  };

  const handleBulkDeletePress = () => {
    if (selectedRows.size === 0) return;
    Alert.alert(
      "Confirm Bulk Delete",
      `Are you sure you want to delete ${selectedRows.size} selected file(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => bulkDeleteMutation.mutate(Array.from(selectedRows)),
        },
      ]
    );
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  // 50-item Pagination
  const totalPages = Math.max(1, Math.ceil(files.length / PAGE_SIZE));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return files.slice(start, start + PAGE_SIZE);
  }, [files, currentPage]);

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => {
        acc.original += file.original_size || 0;
        acc.compressed += file.compressed_size || 0;
        return acc;
      },
      { original: 0, compressed: 0 }
    );
  }, [files]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Dashboard")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>File Ingestion</Text>
          <Text style={styles.navSubtitle}>Archive & Document Context</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
        }
      >
        {/* KPI Metrics */}
        <View style={styles.kpiGrid}>
          <NativeCard style={styles.kpiCard}>
            <NativeCardContent style={styles.kpiContent}>
              <View style={styles.kpiIconBox}>
                <MaterialCommunityIcons name="folder-multiple-outline" size={20} color="#2563eb" />
              </View>
              <Text style={styles.kpiValue}>{files.length}</Text>
              <Text style={styles.kpiLabel}>Total Files</Text>
            </NativeCardContent>
          </NativeCard>

          <NativeCard style={styles.kpiCard}>
            <NativeCardContent style={styles.kpiContent}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#ecfdf5" }]}>
                <MaterialCommunityIcons name="harddisk" size={20} color="#10b981" />
              </View>
              <Text style={styles.kpiValue}>{formatBytes(totals.compressed)}</Text>
              <Text style={styles.kpiLabel}>Storage Used</Text>
            </NativeCardContent>
          </NativeCard>

          <NativeCard style={styles.kpiCard}>
            <NativeCardContent style={styles.kpiContent}>
              <View style={[styles.kpiIconBox, { backgroundColor: "#fef3c7" }]}>
                <MaterialCommunityIcons name="zip-box-outline" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.kpiValue}>
                {totals.original > 0
                  ? `${Math.round((1 - totals.compressed / totals.original) * 100)}%`
                  : "0%"}
              </Text>
              <Text style={styles.kpiLabel}>Compression</Text>
            </NativeCardContent>
          </NativeCard>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedType === "all" && styles.filterChipActive]}
            onPress={() => {
              setSelectedType("all");
              setCurrentPage(1);
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedType === "all" && styles.filterChipTextActive,
              ]}
            >
              All Types ({files.length})
            </Text>
          </TouchableOpacity>

          {uploadTypes.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, selectedType === opt.value && styles.filterChipActive]}
              onPress={() => {
                setSelectedType(opt.value);
                setCurrentPage(1);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === opt.value && styles.filterChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bulk Action Bar */}
        {selectedRows.size > 0 && (
          <View style={styles.bulkActionBar}>
            <Text style={styles.bulkActionText}>
              {selectedRows.size} selected
            </Text>
            <TouchableOpacity
              style={styles.bulkDeleteBtn}
              onPress={handleBulkDeletePress}
            >
              <Ionicons name="trash-outline" size={16} color="#ffffff" />
              <Text style={styles.bulkDeleteText}>Delete Selected</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pagination Top Bar */}
        <View style={styles.paginationBar}>
          <Text style={styles.paginationText}>
            Showing {paginatedFiles.length} of {files.length} • 50 items/page
          </Text>
          <View style={styles.paginationButtons}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? "#cbd5e1" : "#0f172a"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Ionicons name="chevron-forward" size={16} color={currentPage >= totalPages ? "#cbd5e1" : "#0f172a"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Files List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading ingested archives...</Text>
          </View>
        ) : paginatedFiles.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="file-document-outline" size={40} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No files in archive</Text>
            <Text style={styles.emptySubtitle}>No uploaded documents found for this category.</Text>
          </View>
        ) : (
          paginatedFiles.map((file) => {
            const isSelected = selectedRows.has(file.id);
            const isExcel = file.filename.endsWith(".xlsx") || file.filename.endsWith(".xls") || file.filename.endsWith(".csv");
            return (
              <NativeCard key={file.id} style={[styles.fileCard, isSelected && styles.fileCardSelected]}>
                <NativeCardContent style={styles.fileCardContent}>
                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => toggleSelectRow(file.id)}
                  >
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={22}
                      color={isSelected ? "#2563eb" : "#94a3b8"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.fileMainTouch}
                    activeOpacity={0.7}
                    onPress={() => setSelectedFile(file)}
                  >
                    <View style={[styles.fileIconBox, isExcel && { backgroundColor: "#ecfdf5" }]}>
                      <MaterialCommunityIcons
                        name={isExcel ? "file-excel-outline" : "file-document-outline"}
                        size={22}
                        color={isExcel ? "#10b981" : "#2563eb"}
                      />
                    </View>

                    <View style={styles.fileDetails}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.filename}
                      </Text>
                      <View style={styles.fileMetaRow}>
                        <NativeBadge variant="secondary" style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>
                            {file.upload_type_label || file.upload_type}
                          </Text>
                        </NativeBadge>
                        <Text style={styles.fileSizeText}>
                          {formatBytes(file.compressed_size || file.original_size)}
                        </Text>
                        <Text style={styles.fileDateText}>
                          {file.stored_at
                            ? new Date(file.stored_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : "-"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteFileBtn}
                    onPress={() => handleDeletePress(file)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </NativeCardContent>
              </NativeCard>
            );
          })
        )}

        {/* Pagination Footer */}
        {paginatedFiles.length > 0 && (
          <View style={styles.paginationFooter}>
            <TouchableOpacity
              style={[styles.footerPageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="chevron-back" size={16} color="#2563eb" />
              <Text style={styles.footerPageBtnText}>Previous</Text>
            </TouchableOpacity>

            <Text style={styles.footerPageIndicator}>
              Page {currentPage} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.footerPageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.footerPageBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color="#2563eb" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* FILE DETAIL / ACTIONS MODAL                               */}
      {/* ========================================================= */}
      <Modal
        visible={selectedFile !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedFile(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBox}>
                  <MaterialCommunityIcons name="file-document" size={24} color="#2563eb" />
                </View>
                <View style={styles.modalHeaderTitles}>
                  <Text style={styles.modalFileName} numberOfLines={1}>
                    {selectedFile?.filename}
                  </Text>
                  <Text style={styles.modalSub}>
                    {selectedFile?.upload_type_label || selectedFile?.upload_type}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedFile(null)}
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Original Size:</Text>
                <Text style={styles.detailValue}>
                  {formatBytes(selectedFile?.original_size || 0)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Compressed Size:</Text>
                <Text style={styles.detailValue}>
                  {formatBytes(selectedFile?.compressed_size || 0)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uploaded On:</Text>
                <Text style={styles.detailValue}>
                  {selectedFile?.stored_at ? new Date(selectedFile.stored_at).toLocaleString() : "-"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>File ID:</Text>
                <Text style={[styles.detailValue, { fontFamily: "monospace", fontSize: 11 }]}>
                  {selectedFile?.id}
                </Text>
              </View>

              <View style={styles.modalActions}>
                {selectedFile && (
                  <TouchableOpacity
                    style={styles.actionDownloadBtn}
                    onPress={() => Linking.openURL(uploadArchiveService.downloadUrl(selectedFile.id))}
                  >
                    <Ionicons name="download-outline" size={18} color="#ffffff" />
                    <Text style={styles.actionDownloadText}>Download File</Text>
                  </TouchableOpacity>
                )}

                {selectedFile && (
                  <TouchableOpacity
                    style={styles.actionDeleteBtn}
                    onPress={() => {
                      const f = selectedFile;
                      setSelectedFile(null);
                      if (f) handleDeletePress(f);
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    <Text style={styles.actionDeleteText}>Delete Archive</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  navBar: {
    height: 60,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 6,
  },
  navTitleContainer: {
    alignItems: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  navSubtitle: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
  },
  refreshButton: {
    padding: 6,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiContent: {
    padding: 10,
    alignItems: "center",
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  chipsScroll: {
    flexDirection: "row",
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#2563eb",
  },
  bulkActionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  bulkActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e40af",
  },
  bulkDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  bulkDeleteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  paginationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  paginationText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  paginationButtons: {
    flexDirection: "row",
    gap: 6,
  },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  fileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  fileCardSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#f8fbff",
  },
  fileCardContent: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkboxTouch: {
    padding: 2,
  },
  fileMainTouch: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  fileDetails: {
    flex: 1,
    gap: 3,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  fileSizeText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
  },
  fileDateText: {
    fontSize: 10,
    color: "#94a3b8",
  },
  deleteFileBtn: {
    padding: 6,
  },
  paginationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 10,
  },
  footerPageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  footerPageBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  footerPageIndicator: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitles: {
    flex: 1,
  },
  modalFileName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748b",
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  modalActions: {
    marginTop: 14,
    gap: 8,
  },
  actionDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionDownloadText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  actionDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionDeleteText: {
    color: "#dc2626",
    fontWeight: "700",
    fontSize: 13,
  },
});
