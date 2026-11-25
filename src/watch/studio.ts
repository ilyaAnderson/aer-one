import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";

export function createStudio(renderer: WebGLRenderer) {
  const stage = new Scene();
  const wallGeometry = new BoxGeometry(38, 38, 38);
  const wallMaterial = new MeshBasicMaterial({
    color: new Color(0.19, 0.198, 0.205),
    side: BackSide,
  });
  stage.add(new Mesh(wallGeometry, wallMaterial));
  const cardGeometry = new PlaneGeometry(1, 1);
  const cardMaterials: MeshBasicMaterial[] = [];

  function softbox(
    position: [number, number, number],
    width: number,
    height: number,
    color: Color,
  ) {
    const material = new MeshBasicMaterial({ color });
    cardMaterials.push(material);
    const card = new Mesh(cardGeometry, material);
    card.position.fromArray(position);
    card.scale.set(width, height, 1);
    card.lookAt(new Vector3());
    stage.add(card);
  }

  softbox([-5.6, 6.3, 2.8], 9.0, 8.4, new Color(3.1, 3.03, 2.96));
  softbox([4.2, 4.2, 7], 1.8, 15.4, new Color(3.16, 3.2, 3.25));
  softbox([7, 1.96, -4.9], 6.86, 10.92, new Color(1.76, 1.77, 1.8));
  softbox([-3.5, -2.8, -7], 5.6, 16.8, new Color(1.39, 1.4, 1.42));

  softbox([5, -3.6, 4.9], 6.5, 5.4, new Color(0.76, 0.79, 0.82));

  const generator = new PMREMGenerator(renderer);
  const environment = generator.fromScene(stage, 0, 0.1, 50);
  generator.dispose();
  for (const material of cardMaterials) material.dispose();
  wallMaterial.dispose();
  wallGeometry.dispose();
  cardGeometry.dispose();
  return environment;
}
