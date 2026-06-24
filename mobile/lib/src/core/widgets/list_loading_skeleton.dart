import 'package:flutter/material.dart';

class ListLoadingSkeleton extends StatelessWidget {
  const ListLoadingSkeleton({
    super.key,
    this.itemCount = 4,
    this.itemHeight = 120,
  });

  final int itemCount;
  final double itemHeight;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => _SkeletonBlock(height: itemHeight, color: base),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height, required this.color});

  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}
