
export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricDefinition {
    name: string;
    help: string;
    type: MetricType;
    labels?: string[];
}

export class MetricsRegistry {
    private metrics = new Map<string, any>();

    registerCounter(name: string, help: string, labels: string[] = []) {
        this.metrics.set(name, { type: 'counter', help, labels, value: 0, values: new Map<string, number>() });
    }

    registerGauge(name: string, help: string, labels: string[] = []) {
        this.metrics.set(name, { type: 'gauge', help, labels, value: 0, values: new Map<string, number>() });
    }

    registerHistogram(name: string, help: string, labels: string[] = [], buckets: number[] = [0.1, 0.5, 1, 5, 10]) {
        this.metrics.set(name, { type: 'histogram', help, labels, buckets, values: new Map<string, number[]>() });
    }

    increment(name: string, labels: Record<string, string> = {}, value: number = 1) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'counter') return;
        
        const key = this.getLabelKey(labels);
        const current = metric.values.get(key) || 0;
        metric.values.set(key, current + value);
    }

    set(name: string, value: number, labels: Record<string, string> = {}) {
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'gauge') return;

        const key = this.getLabelKey(labels);
        metric.values.set(key, value);
    }

    observe(name: string, value: number, labels: Record<string, string> = {}) {
        // Simplified histogram
        const metric = this.metrics.get(name);
        if (!metric || metric.type !== 'histogram') return;
         // In a real impl, we'd bucket this
    }

    getMetrics() {
        return Object.fromEntries(this.metrics);
    }

    private getLabelKey(labels: Record<string, string>): string {
        return Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(',');
    }
}

export const globalMetrics = new MetricsRegistry();
