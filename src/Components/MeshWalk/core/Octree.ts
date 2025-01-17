import {
  Box3,
  Line3,
  // Plane,
  Sphere,
  Vector3,
  Mesh,
  type Ray,
  type Object3D,
} from "three";
// import { Capsule } from '../math/Capsule.js';
import {ComputedTriangle} from "../math/triangle";
import {intersectsLineBox} from "../math/intersectsLineBox";
import {intersectsLineTriangle} from "../math/intersectsLineTriangle";

const _v1 = new Vector3();
const _v2 = new Vector3();
// const _plane = new Plane();
// const _line1 = new Line3();
// const _line2 = new Line3();
// const _sphere = new Sphere();
// const _capsule = new Capsule();

export class Octree {
  box: Box3;
  bounds = new Box3();
  triangles: ComputedTriangle[] = [];
  subTrees: Octree[] = [];

  constructor(box: Box3 = new Box3()) {
    this.box = box;
  }

  addTriangle(triangle: ComputedTriangle) {
    this.bounds.min.x = Math.min(
      this.bounds.min.x,
      triangle.a.x,
      triangle.b.x,
      triangle.c.x
    );
    this.bounds.min.y = Math.min(
      this.bounds.min.y,
      triangle.a.y,
      triangle.b.y,
      triangle.c.y
    );
    this.bounds.min.z = Math.min(
      this.bounds.min.z,
      triangle.a.z,
      triangle.b.z,
      triangle.c.z
    );
    this.bounds.max.x = Math.max(
      this.bounds.max.x,
      triangle.a.x,
      triangle.b.x,
      triangle.c.x
    );
    this.bounds.max.y = Math.max(
      this.bounds.max.y,
      triangle.a.y,
      triangle.b.y,
      triangle.c.y
    );
    this.bounds.max.z = Math.max(
      this.bounds.max.z,
      triangle.a.z,
      triangle.b.z,
      triangle.c.z
    );

    this.triangles.push(triangle);
  }

  calcBox() {
    this.box.set(this.bounds.min, this.bounds.max);

    // offset small amount to account for regular grid
    this.box.min.x -= 0.01;
    this.box.min.y -= 0.01;
    this.box.min.z -= 0.01;

    return this;
  }

  split(level: number) {
    const subTrees: Octree[] = [];
    const halfSize = _v2
      .copy(this.box.max)
      .sub(this.box.min)
      .multiplyScalar(0.5);

    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const box = new Box3();
          const v = _v1.set(x, y, z);

          box.min.copy(this.box.min).add(v.multiply(halfSize));
          box.max.copy(box.min).add(halfSize);

          subTrees.push(new Octree(box));
        }
      }
    }

    let triangle;

    while ((triangle = this.triangles.pop())) {
      for (let i = 0; i < subTrees.length; i++) {
        if (subTrees[i].box.intersectsTriangle(triangle)) {
          subTrees[i].triangles.push(triangle);
        }
      }
    }

    for (let i = 0; i < subTrees.length; i++) {
      const len = subTrees[i].triangles.length;

      if (len > 8 && level < 16) {
        subTrees[i].split(level + 1);
      }

      if (len !== 0) {
        this.subTrees.push(subTrees[i]);
      }
    }
  }

  build() {
    this.calcBox();
    this.split(0);

    return this;
  }

  getLineTriangles(line: Line3, result: ComputedTriangle[]) {
    for (let i = 0; i < this.subTrees.length; i++) {
      const subTree = this.subTrees[i];
      if (!intersectsLineBox(line, subTree.box)) continue;

      if (subTree.triangles.length > 0) {
        for (let j = 0; j < subTree.triangles.length; j++) {
          if (result.indexOf(subTree.triangles[j]) === -1)
            result.push(subTree.triangles[j]);
        }
      } else {
        subTree.getLineTriangles(line, result);
      }
    }

    return result;
  }

  getRayTriangles(ray: Ray, result: ComputedTriangle[]) {
    for (let i = 0; i < this.subTrees.length; i++) {
      const subTree = this.subTrees[i];
      if (!ray.intersectsBox(subTree.box)) continue;

      if (subTree.triangles.length > 0) {
        for (let j = 0; j < subTree.triangles.length; j++) {
          if (result.indexOf(subTree.triangles[j]) === -1)
            result.push(subTree.triangles[j]);
        }
      } else {
        subTree.getRayTriangles(ray, result);
      }
    }

    return result;
  }

  getSphereTriangles(sphere: Sphere, result: ComputedTriangle[]) {
    for (let i = 0; i < this.subTrees.length; i++) {
      const subTree = this.subTrees[i];

      if (!sphere.intersectsBox(subTree.box)) continue;

      if (subTree.triangles.length > 0) {
        for (let j = 0; j < subTree.triangles.length; j++) {
          if (result.indexOf(subTree.triangles[j]) === -1)
            result.push(subTree.triangles[j]);
        }
      } else {
        subTree.getSphereTriangles(sphere, result);
      }
    }

    return result;
  }

  getCapsuleTriangles(capsule: Sphere, result: ComputedTriangle[]) {
    for (let i = 0; i < this.subTrees.length; i++) {
      const subTree = this.subTrees[i];

      if (!capsule.intersectsBox(subTree.box)) continue;

      if (subTree.triangles.length > 0) {
        for (let j = 0; j < subTree.triangles.length; j++) {
          if (result.indexOf(subTree.triangles[j]) === -1)
            result.push(subTree.triangles[j]);
        }
      } else {
        subTree.getCapsuleTriangles(capsule, result);
      }
    }
  }

  lineIntersect(line: Line3) {
    const position = new Vector3();
    const triangles: ComputedTriangle[] = [];
    let distanceSquared = Infinity;
    let triangle: ComputedTriangle | null = null;

    this.getLineTriangles(line, triangles);

    for (let i = 0; i < triangles.length; i++) {
      const result = _v1;
      const isIntersected = intersectsLineTriangle(
        line.start,
        line.end,
        triangles[i].a,
        triangles[i].b,
        triangles[i].c,
        result
      );

      if (isIntersected) {
        const newDistanceSquared = line.start.distanceToSquared(result);

        if (distanceSquared > newDistanceSquared) {
          position.copy(result);
          distanceSquared = newDistanceSquared;
          triangle = triangles[i];
        }
      }
    }

    return triangle
      ? {distance: Math.sqrt(distanceSquared), triangle, position}
      : false;
  }

  rayIntersect(ray: Ray) {
    if (ray.direction.lengthSq() === 0) return;

    const triangles: ComputedTriangle[] = [];
    let triangle,
      position,
      distanceSquared = 1e100;

    this.getRayTriangles(ray, triangles);

    for (let i = 0; i < triangles.length; i++) {
      const result = ray.intersectTriangle(
        triangles[i].a,
        triangles[i].b,
        triangles[i].c,
        true,
        _v1
      );

      if (result) {
        const newDistanceSquared = result.sub(ray.origin).lengthSq();

        if (distanceSquared > newDistanceSquared) {
          position = result.clone().add(ray.origin);
          distanceSquared = newDistanceSquared;
          triangle = triangles[i];
        }
      }
    }

    return distanceSquared < 1e100
      ? {distance: Math.sqrt(distanceSquared), triangle, position}
      : false;
  }

  addGraphNode(object: Object3D) {
    object.updateWorldMatrix(true, true);
    object.traverse((childObject) => {
      if (childObject instanceof Mesh) {
        const mesh = childObject;
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrix);
        geometry.computeVertexNormals();

        if (geometry.index) {
          const indices = geometry.index.array;
          const positions = geometry.attributes.position.array;
          const groups =
            geometry.groups.length !== 0
              ? geometry.groups
              : [{start: 0, count: indices.length, materialIndex: 0}];

          for (let i = 0, l = groups.length; i < l; ++i) {
            const start = groups[i].start;
            const count = groups[i].count;

            for (let ii = start, ll = start + count; ii < ll; ii += 3) {
              const a = indices[ii];
              const b = indices[ii + 1];
              const c = indices[ii + 2];

              const vA = new Vector3().fromArray(positions, a * 3);
              const vB = new Vector3().fromArray(positions, b * 3);
              const vC = new Vector3().fromArray(positions, c * 3);

              const triangle = new ComputedTriangle(vA, vB, vC);
              // ポリゴンの継ぎ目の辺で raycast が交差しない可能性があるので、わずかに拡大する
              triangle.extend(1e-10);
              triangle.computeBoundingSphere();
              this.addTriangle(triangle);
            }
          }
        }
      }
    });

    this.build();
  }

  addGraphBox(box: Box3) {
    const {min, max} = box;
    const p0 = max.clone();
    const p1 = new Vector3(min.x, max.y, max.z);
    const p2 = new Vector3(min.x, min.y, max.z);
    const p3 = new Vector3(max.x, min.y, max.z);

    const p4 = new Vector3(min.x, max.y, min.z);
    const p5 = new Vector3(max.x, max.y, min.z);
    const p6 = new Vector3(max.x, min.y, min.z);
    const p7 = min.clone();

    const points: Vector3[] = [];
    //0,1,2,3
    points.push(p0);
    points.push(p1);
    points.push(p2);
    points.push(p2);
    points.push(p3);
    points.push(p0);
    //0,5,6,3
    points.push(p0);
    points.push(p5);
    points.push(p6);
    points.push(p6);
    points.push(p3);
    points.push(p0);
    //0,5,4,1
    points.push(p0);
    points.push(p5);
    points.push(p4);
    points.push(p4);
    points.push(p1);
    points.push(p0);
    //7,2,3,6
    points.push(p7);
    points.push(p2);
    points.push(p3);
    points.push(p3);
    points.push(p6);
    points.push(p7);
    //7,6,5,4
    points.push(p7);
    points.push(p6);
    points.push(p5);
    points.push(p5);
    points.push(p4);
    points.push(p7);
    //7,2,1,4
    points.push(p7);
    points.push(p2);
    points.push(p1);
    points.push(p1);
    points.push(p4);
    points.push(p7);
    this.createTriangle(points);
    this.build();
  }
  private createTriangle(points: Vector3[]) {
    for (let i = 0; i < points.length; i += 3) {
      const triangle = new ComputedTriangle(
        points[i + 0],
        points[i + 1],
        points[i + 2]
      );
      // ポリゴンの継ぎ目の辺で raycast が交差しない可能性があるので、わずかに拡大する
      triangle.extend(1e-10);
      triangle.computeBoundingSphere();
      this.addTriangle(triangle);
    }
  }
}
