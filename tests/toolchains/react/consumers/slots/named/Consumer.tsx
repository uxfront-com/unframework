import Card from "../../../../../integration/cases/slots/named/__output__/react/Card";
import Post from "../../../../../integration/cases/slots/named/__output__/react/Post";

export function Consumer() {
  return (
    <>
      <Card header={<h2>Title</h2>}>
        <p>Body</p>
      </Card>
      <Post author="Ada" />
    </>
  );
}
